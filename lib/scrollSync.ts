export function syncScrollPanels(
  source: HTMLDivElement,
  target: HTMLDivElement,
  sourcePrefix: string,
  targetPrefix: string,
  pageCount: number,
  isSyncingRef: React.MutableRefObject<boolean>,
) {
  if (isSyncingRef.current) return
  const containerTop = source.scrollTop
  const containerBottom = containerTop + source.clientHeight
  let bestIdx = 0, bestVisible = 0
  for (let i = 0; i < pageCount; i++) {
    const el = document.getElementById(`${sourcePrefix}-page-${i}`)
    if (!el) continue
    const elTop = el.offsetTop
    const elBottom = elTop + el.offsetHeight
    const visible = Math.max(0, Math.min(containerBottom, elBottom) - Math.max(containerTop, elTop))
    if (visible > bestVisible) { bestVisible = visible; bestIdx = i }
  }
  const targetEl = document.getElementById(`${targetPrefix}-page-${bestIdx}`)
  const sourceEl = document.getElementById(`${sourcePrefix}-page-${bestIdx}`)
  if (!targetEl || !sourceEl) return
  isSyncingRef.current = true
  target.scrollTop = targetEl.offsetTop + (containerTop - sourceEl.offsetTop)
  requestAnimationFrame(() => { isSyncingRef.current = false })
}
