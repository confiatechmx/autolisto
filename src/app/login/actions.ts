'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?message=Credenciales+inv%C3%A1lidas.+Usa+el+bot%C3%B3n+de+Acceso+Demo+instant%C3%A1neo.')
  }

  revalidatePath('/', 'layout')
  redirect('/tablero')
}

export async function loginDemo() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: 'demo@autolisto.mx',
    password: 'AutoListo2026!',
  })

  if (error) {
    redirect('/login?message=Error+al+iniciar+modo+demo')
  }

  revalidatePath('/', 'layout')
  redirect('/tablero')
}
