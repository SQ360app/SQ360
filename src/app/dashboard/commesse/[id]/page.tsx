import { redirect } from 'next/navigation'

export default async function CommessaDefaultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/commesse/${id}/anagrafica`)
}
