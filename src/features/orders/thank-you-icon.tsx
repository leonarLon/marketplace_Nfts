import type { SVGProps } from 'react'

/**
 * Ícone "Thank you" do modal de confirmação (Figma, frame "Desktop / Confirmação de Pedido").
 * Redesenhado em SVG a partir do frame enquanto o asset original não pôde ser exportado
 * (limite do Figma MCP); registrado como pendência em ARCHITECTURE.md.
 */
export function ThankYouIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 66 80" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2 34 L33 12 L64 34 V78 H2 Z" />
      <path d="M2 78 L26 54 M64 78 L40 54" />
      <path d="M2 34 L33 58 L64 34" />
      <rect x="10" y="4" width="46" height="40" rx="3" fill="var(--surface, #221815)" />
      <path d="M28 4 Q33 -1 38 4" />
      <text x="33" y="21" textAnchor="middle" fontSize="11" fontWeight="800" fill="currentColor" stroke="none" fontFamily="inherit">
        THANK
      </text>
      <text x="33" y="34" textAnchor="middle" fontSize="11" fontWeight="800" fill="currentColor" stroke="none" fontFamily="inherit">
        YOU
      </text>
    </svg>
  )
}
