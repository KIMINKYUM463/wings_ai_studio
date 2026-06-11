import { PublicShoppingLinkClient } from "./PublicShoppingLinkClient"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function PublicShoppingLinkPage({ params }: Props) {
  const { slug } = await params
  return <PublicShoppingLinkClient slug={decodeURIComponent(slug)} />
}
