declare module 'html-to-image' {
  export type Options = {
    cacheBust?: boolean
    filter?: (node: HTMLElement) => boolean
    height?: number
    pixelRatio?: number
    width?: number
    backgroundColor?: string
  }

  export function toPng(node: HTMLElement, options?: Options): Promise<string>
}
