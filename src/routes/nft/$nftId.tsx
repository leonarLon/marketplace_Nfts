import { createFileRoute } from '@tanstack/react-router'
import { NftDetailPage } from '@/features/nft/nft-detail-page'

export const Route = createFileRoute('/nft/$nftId')({
  component: function NftRoute() {
    const { nftId } = Route.useParams()
    // key: trocar de NFT reinicia edição/quantidade selecionadas.
    return <NftDetailPage key={nftId} nftId={nftId} />
  },
})
