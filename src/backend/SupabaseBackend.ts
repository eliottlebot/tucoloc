import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { InvalidCredentialsError, type Backend, type Flatmate, type Session, type Topic, type Unsubscribe } from './Backend'

const TOPIC_BY_TABLE: Record<string, Topic> = { flatmates: 'flatmates' }

export class SupabaseBackend implements Backend {
  private client: SupabaseClient

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

  subscribe(onChange: (topic: Topic) => void): Unsubscribe {
    const channel = this.client
      .channel('changes')
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
