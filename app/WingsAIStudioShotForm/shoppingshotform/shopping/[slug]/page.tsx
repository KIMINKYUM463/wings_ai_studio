import { notFound } from "next/navigation"
import { sanitizeShoppingLinkSlug } from "@/lib/shotform-shopping-link-types"
import { readShoppingLinkPage } from "@/lib/shotform-shopping-link-server"
import { normalizeShoppingLinkPageData } from "@/lib/shotform-shopping-link-store"
import { PublicShoppingLinkClient } from "./PublicShoppingLinkClient"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function PublicShoppingLinkPage({ params }: Props) {
  const { slug } = await params
  const safe = sanitizeShoppingLinkSlug(decodeURIComponent(slug))
  if (!safe) notFound()

  const page = await readShoppingLinkPage(safe)
  if (!page) notFound()

  return <PublicShoppingLinkClient page={normalizeShoppingLinkPageData(page)} />
}
