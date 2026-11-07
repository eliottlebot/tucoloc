import { createClient, isAuthError, isAuthRetryableFetchError, StorageApiError, type SupabaseClient } from '@supabase/supabase-js'
import { ConnectionError, InvalidCredentialsError, MissingFlatmateError, type Backend, type Expense, type ExpenseChanges, type Flatmate, type Meal, type NewExpense, type NewRecipe, type NewSettlement, type Occupancy, type Photo, type Recipe, type RecipeChanges, type RoomId, type Session, type Settlement, type Topic, type Unsubscribe } from './Backend'

/** A request that got no answer becomes a ConnectionError; an answer refusing it (or a bug) stays as it is. */
function orConnectionError(error: { message: string; code?: string }) {
  if (isAuthError(error)) return isAuthRetryableFetchError(error) ? new ConnectionError() : error
  // Storage wraps every answer it got in a StorageApiError.
  if (error instanceof StorageApiError) return error
  // PostgREST answers always carry an error code; a request that never reached it has none.
  return error.code ? error : new ConnectionError()
}

const PHOTOS = 'recipe-photos'
/** Photos are private: shown through signed links, renewed on every reload. */
const PHOTO_LINK_SECONDS = 30 * 24 * 60 * 60

const TOPIC_BY_TABLE: Record<string, Topic> = { flatmates: 'flatmates', rooms: 'occupancies', expenses: 'expenses', settlements: 'settlements', recipes: 'recipes', meal: 'meal' }

export class SupabaseBackend implements Backend {
  private client: SupabaseClient
  // supabase-js reuses a channel by name, and a subscribed channel takes no new listeners
  private channelCount = 0

  constructor(url: string, publishableKey: string) {
    this.client = createClient(url, publishableKey)
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession()
    if (error) throw orConnectionError(error)
    return data.session ? this.sessionFor(data.session.user.id) : null
  }

  async login(email: string, password: string): Promise<Session> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error?.code === 'invalid_credentials') throw new InvalidCredentialsError()
    if (error) throw orConnectionError(error)
    return this.sessionFor(data.user.id)
  }

  async logout(): Promise<void> {
    const { error } = await this.client.auth.signOut()
    if (error) throw orConnectionError(error)
  }

  async listFlatmates(): Promise<Flatmate[]> {
    const { data, error } = await this.client.from('flatmates').select('id, name').order('name')
    if (error) throw orConnectionError(error)
    return data
  }

  async listOccupancies(): Promise<Occupancy[]> {
    const { data, error } = await this.client.from('rooms').select('id, flatmate_id, since').not('flatmate_id', 'is', null)
    if (error) throw orConnectionError(error)
    return data.map((r) => ({ room: r.id as RoomId, flatmateId: r.flatmate_id, since: new Date(r.since) }))
  }

  async occupy(room: RoomId, flatmateId: string, since: Date): Promise<void> {
    const { error } = await this.client.from('rooms').update({ flatmate_id: flatmateId, since: since.toISOString() }).eq('id', room)
    if (error) throw orConnectionError(error)
  }

  async free(room: RoomId): Promise<void> {
    const { error } = await this.client.from('rooms').update({ flatmate_id: null, since: null }).eq('id', room)
    if (error) throw orConnectionError(error)
  }

  async listExpenses(): Promise<Expense[]> {
    const { data, error } = await this.client
      .from('expenses')
      .select('id, label, amount_cents, date, payer_id, participant_ids, creator_id, created_at')
    if (error) throw orConnectionError(error)
    return data.map((e) => ({
      id: e.id,
      label: e.label,
      amountCents: e.amount_cents,
      date: e.date,
      payerId: e.payer_id,
      participantIds: e.participant_ids,
      creatorId: e.creator_id,
      createdAt: new Date(e.created_at),
    }))
  }

  async createExpense(expense: NewExpense): Promise<void> {
    const { error } = await this.client.from('expenses').insert({
      label: expense.label,
      amount_cents: expense.amountCents,
      date: expense.date,
      payer_id: expense.payerId,
      participant_ids: expense.participantIds,
      creator_id: expense.creatorId,
      created_at: expense.createdAt.toISOString(),
    })
    if (error) throw orConnectionError(error)
  }

  async updateExpense(id: string, changes: ExpenseChanges): Promise<void> {
    const { error } = await this.client
      .from('expenses')
      .update({
        label: changes.label,
        amount_cents: changes.amountCents,
        date: changes.date,
        payer_id: changes.payerId,
        participant_ids: changes.participantIds,
      })
      .eq('id', id)
    if (error) throw orConnectionError(error)
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await this.client.from('expenses').delete().eq('id', id)
    if (error) throw orConnectionError(error)
  }

  async listSettlements(): Promise<Settlement[]> {
    const { data, error } = await this.client.from('settlements').select('id, created_at, creator_id, transfers')
    if (error) throw orConnectionError(error)
    return data.map((s) => ({
      id: s.id,
      createdAt: new Date(s.created_at),
      creatorId: s.creator_id,
      transfers: (s.transfers as { from_id: string; to_id: string; amount_cents: number }[]).map((t) => ({
        fromId: t.from_id,
        toId: t.to_id,
        cents: t.amount_cents,
      })),
    }))
  }

  async createSettlement(settlement: NewSettlement): Promise<void> {
    const { error } = await this.client.from('settlements').insert({
      created_at: settlement.createdAt.toISOString(),
      creator_id: settlement.creatorId,
      transfers: settlement.transfers.map((t) => ({ from_id: t.fromId, to_id: t.toId, amount_cents: t.cents })),
    })
    if (error) throw orConnectionError(error)
  }

  async deleteSettlement(id: string): Promise<void> {
    const { error } = await this.client.from('settlements').delete().eq('id', id)
    if (error) throw orConnectionError(error)
  }

  async listRecipes(): Promise<Recipe[]> {
    const { data, error } = await this.client.from('recipes').select('id, title, text, link, photo_path, proteins_g, carbs_g, fats_g, creator_id')
    if (error) throw orConnectionError(error)
    const paths: string[] = data.flatMap((r) => (r.photo_path ? [r.photo_path] : []))
    const urls = new Map<string, string>()
    if (paths.length > 0) {
      const signed = await this.client.storage.from(PHOTOS).createSignedUrls(paths, PHOTO_LINK_SECONDS)
      if (signed.error) throw orConnectionError(signed.error)
      for (const s of signed.data) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
    }
    return data.map((r) => ({
      id: r.id,
      title: r.title,
      text: r.text,
      link: r.link,
      // A link that failed to sign shows no image, but the path stays so an edit doesn't drop the photo.
      photo: r.photo_path ? { path: r.photo_path, url: urls.get(r.photo_path) ?? '' } : null,
      proteins: r.proteins_g,
      carbs: r.carbs_g,
      fats: r.fats_g,
      creatorId: r.creator_id,
    }))
  }

  async createRecipe(recipe: NewRecipe): Promise<void> {
    const { error } = await this.client
      .from('recipes')
      .insert({
        title: recipe.title,
        text: recipe.text,
        link: recipe.link,
        photo_path: recipe.photo?.path ?? null,
        proteins_g: recipe.proteins,
        carbs_g: recipe.carbs,
        fats_g: recipe.fats,
        creator_id: recipe.creatorId,
      })
    if (error) throw orConnectionError(error)
  }

  async updateRecipe(id: string, changes: RecipeChanges): Promise<void> {
    const { error } = await this.client
      .from('recipes')
      .update({
        title: changes.title,
        text: changes.text,
        link: changes.link,
        photo_path: changes.photo?.path ?? null,
        proteins_g: changes.proteins,
        carbs_g: changes.carbs,
        fats_g: changes.fats,
      })
      .eq('id', id)
    if (error) throw orConnectionError(error)
  }

  async deleteRecipe(id: string): Promise<void> {
    const { error } = await this.client.from('recipes').delete().eq('id', id)
    if (error) throw orConnectionError(error)
  }

  async uploadPhoto(file: Blob): Promise<Photo> {
    const path = crypto.randomUUID()
    const uploaded = await this.client.storage.from(PHOTOS).upload(path, file, { contentType: file.type })
    if (uploaded.error) throw orConnectionError(uploaded.error)
    const signed = await this.client.storage.from(PHOTOS).createSignedUrl(path, PHOTO_LINK_SECONDS)
    if (signed.error) throw orConnectionError(signed.error)
    return { path, url: signed.data.signedUrl }
  }

  async getMeal(): Promise<Meal | null> {
    const { data, error } = await this.client.from('meal').select('recipe_id, text, set_by, set_at').maybeSingle()
    if (error) throw orConnectionError(error)
    return data && { recipeId: data.recipe_id, text: data.text, setBy: data.set_by, setAt: new Date(data.set_at) }
  }

  async setMeal(meal: Meal): Promise<void> {
    const { error } = await this.client.from('meal').upsert({
      id: true,
      recipe_id: meal.recipeId,
      text: meal.text,
      set_by: meal.setBy,
      set_at: meal.setAt.toISOString(),
    })
    if (error) throw orConnectionError(error)
  }

  async clearMeal(): Promise<void> {
    const { error } = await this.client.from('meal').delete().eq('id', true)
    if (error) throw orConnectionError(error)
  }

  subscribe(onChange: (topic: Topic) => void): Unsubscribe {
    const channel = this.client
      .channel(`changes-${++this.channelCount}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const topic = TOPIC_BY_TABLE[payload.table]
        if (topic) onChange(topic)
      })
      .subscribe()
    return () => {
      this.client.removeChannel(channel)
    }
  }

  private async sessionFor(userId: string): Promise<Session> {
    const { data, error } = await this.client.from('flatmates').select('id, name').eq('id', userId).maybeSingle()
    if (error) throw orConnectionError(error)
    if (!data) {
      await this.client.auth.signOut()
      throw new MissingFlatmateError()
    }
    return { flatmate: data }
  }
}
