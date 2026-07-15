const EDGE_GRID_LONG_EDGE = 280;

export function detectDocumentCrop(data: Uint8Array, width: number, height: number) {
  if (width < 320 || height < 320) return null;

  const scale = Math.min(1, EDGE_GRID_LONG_EDGE / Math.max(width, height));
  const gridWidth = Math.max(40, Math.round(width * scale));
  const gridHeight = Math.max(40, Math.round(height * scale));
  const gray = downsampleGrayscale(data, width, height, gridWidth, gridHeight);
  const columnScores = new Float64Array(gridWidth);
  const rowScores = new Float64Array(gridHeight);

  for (let y = 1; y < gridHeight - 1; y += 1) {
    for (let x = 1; x < gridWidth - 1; x += 1) {
      const index = y * gridWidth + x;
      columnScores[x] += Math.abs(gray[index + 1] - gray[index - 1]);
      rowScores[y] += Math.abs(gray[index + gridWidth] - gray[index - gridWidth]);
    }
  }

  const left = findStrongEdge(columnScores, 0.02, 0.36);
  const right = findStrongEdge(columnScores, 0.64, 0.98);
  const top = findStrongEdge(rowScores, 0.02, 0.36);
  const bottom = findStrongEdge(rowScores, 0.64, 0.98);
  if (!left || !right || !top || !bottom) return null;

  const paddingX = Math.round(gridWidth * 0.012);
  const paddingY = Math.round(gridHeight * 0.012);
  const gridLeft = Math.max(0, left.index - paddingX);
  const gridRight = Math.min(gridWidth - 1, right.index + paddingX);
  const gridTop = Math.max(0, top.index - paddingY);
  const gridBottom = Math.min(gridHeight - 1, bottom.index + paddingY);
  const areaRatio = ((gridRight - gridLeft) * (gridBottom - gridTop)) / (gridWidth * gridHeight);
  const removedMargin = 1 - areaRatio;

  if (areaRatio < 0.42 || removedMargin < 0.055 || left.ratio < 1.25 || right.ratio < 1.25 || top.ratio < 1.25 || bottom.ratio < 1.25) {
    return null;
  }

  const x = clamp(Math.round((gridLeft / gridWidth) * width), 0, width - 2);
  const y = clamp(Math.round((gridTop / gridHeight) * height), 0, height - 2);
  const cropWidth = clamp(Math.round(((gridRight - gridLeft) / gridWidth) * width), 2, width - x);
  const cropHeight = clamp(Math.round(((gridBottom - gridTop) / gridHeight) * height), 2, height - y);
  return { x, y, width: cropWidth, height: cropHeight };
}

function downsampleGrayscale(data: Uint8Array, width: number, height: number, targetWidth: number, targetHeight: number) {
  const result = new Uint8Array(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / targetWidth));
      const sourceIndex = (sourceY * width + sourceX) * 4;
      result[y * targetWidth + x] = luminance(data[sourceIndex], data[sourceIndex + 1], data[sourceIndex + 2]);
    }
  }
  return result;
}

function findStrongEdge(scores: Float64Array, startRatio: number, endRatio: number) {
  const smoothed = new Float64Array(scores.length);
  for (let index = 2; index < scores.length - 2; index += 1) {
    smoothed[index] = (scores[index - 2] + scores[index - 1] * 2 + scores[index] * 3 + scores[index + 1] * 2 + scores[index + 2]) / 9;
  }
  const start = Math.max(2, Math.floor(scores.length * startRatio));
  const end = Math.min(scores.length - 3, Math.ceil(scores.length * endRatio));
  const population = Array.from(smoothed.slice(start, end)).sort((a, b) => a - b);
  if (!population.length) return null;
  const baseline = population[Math.floor(population.length * 0.5)] || 1;
  let index = start;
  for (let candidate = start + 1; candidate < end; candidate += 1) {
    if (smoothed[candidate] > smoothed[index]) index = candidate;
  }
  return { index, ratio: smoothed[index] / Math.max(1, baseline) };
}

function luminance(red: number, green: number, blue: number) {
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
