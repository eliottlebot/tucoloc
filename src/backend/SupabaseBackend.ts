import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { InvalidCredentialsError, type Backend, type Flatmate, type Occupancy, type RoomId, type Session, type Topic, type Unsubscribe } from './Backend'

const TOPIC_BY_TABLE: Record<string, Topic> = { flatmates: 'flatmates', rooms: 'occupancies' }

export class SupabaseBackend implements Backend {
  private client: SupabaseClient
  // supabase-js reuses a channel by name, and a subscribed channel takes no new listeners
  private channelCount = 0

  constructor(url: string, publishableKey: string) {
    this.client = createClient(url, publishableKey)
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession()
    if (error) throw error
    return data.session ? this.sessionFor(data.session.user.id) : null
  }

  async login(email: string, password: string): Promise<Session> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error?.code === 'invalid_credentials') throw new InvalidCredentialsError()
    if (error) throw error
    return this.sessionFor(data.user.id)
  }

  async logout(): Promise<void> {
    const { error } = await this.client.auth.signOut()
    if (error) throw error
  }

  async listFlatmates(): Promise<Flatmate[]> {
    const { data, error } = await this.client.from('flatmates').select('id, name').order('name')
    if (error) throw error
    return data
  }

  async listOccupancies(): Promise<Occupancy[]> {
    const { data, error } = await this.client.from('rooms').select('id, flatmate_id, since').not('flatmate_id', 'is', null)
    if (error) throw error
    return data.map((r) => ({ room: r.id as RoomId, flatmateId: r.flatmate_id, since: new Date(r.since) }))
  }

  async occupy(room: RoomId, flatmateId: string, since: Date): Promise<void> {
    const { error } = await this.client.from('rooms').update({ flatmate_id: flatmateId, since: since.toISOString() }).eq('id', room)
    if (error) throw error
  }

  async free(room: RoomId): Promise<void> {
    const { error } = await this.client.from('rooms').update({ flatmate_id: null, since: null }).eq('id', room)
    if (error) throw error
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
    const { data, error } = await this.client.from('flatmates').select('id, name').eq('id', userId).single()
    if (error) throw error
    return { flatmate: data }
  }
}
