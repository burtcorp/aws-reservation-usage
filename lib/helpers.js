exports.relativeSize = (size) => {
  let sizes = ['nano', 'micro', 'small', 'medium', 'large', 'xlarge']
  let n = sizes.indexOf(size)
  if (n == 0) {
    return 0.25
  } else if (n == 1) {
    return 0.5
  } else if (n >= 2) {
    return Math.pow(2, n - 2)
  } else {
    let matches = size != null && size.match(/^(\d+)xlarge/)
    if (matches) {
      return 8 * parseInt(matches[1])
    } else {
      throw new Error(`Unsupported size: "${size}"`)
    }
  }
}
