/**
 * Returns a lower Cholesky factor. If the sample covariance is singular or
 * non-positive-definite, diagonal ridge jitter is tried from scale*1e-12 to
 * scale*1e-5. The selected amount is returned for Diagnostics; it is never silent.
 */
export function factorCovariance(covariance) {
  validateCovariance(covariance);
  const direct = cholesky(covariance);
  if (direct) return { factor: direct, stabilization: { applied: false, method: "none", diagonalJitter: 0, attempts: 0 } };
  const scale = Math.max(1e-12, ...covariance.map((row, index) => Math.abs(row[index])));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const jitter = scale * 10 ** (-12 + attempt);
    const stabilized = covariance.map((row, rowIndex) => row.map((value, columnIndex) => value + (rowIndex === columnIndex ? jitter : 0)));
    const factor = cholesky(stabilized);
    if (factor) return { factor, stabilization: { applied: true, method: "bounded-diagonal-ridge-jitter", diagonalJitter: jitter, attempts: attempt + 1 } };
  }
  throw codedError("INVALID_COVARIANCE", "Sample covariance could not be stabilized with the documented bounded diagonal ridge method.");
}

export function cholesky(matrix) {
  const size = matrix.length; const lower = Array.from({ length: size }, () => Array(size).fill(0));
  for (let row = 0; row < size; row += 1) for (let column = 0; column <= row; column += 1) {
    let sum = matrix[row][column]; for (let k = 0; k < column; k += 1) sum -= lower[row][k] * lower[column][k];
    if (row === column) { if (!Number.isFinite(sum) || sum <= 0) return null; lower[row][column] = Math.sqrt(sum); }
    else { if (lower[column][column] === 0) return null; lower[row][column] = sum / lower[column][column]; }
  }
  return lower;
}

export function multiplyLowerTriangular(lower, vector) { return lower.map((row, index) => row.slice(0, index + 1).reduce((sum, value, column) => sum + value * vector[column], 0)); }
function validateCovariance(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0 || matrix.some((row) => !Array.isArray(row) || row.length !== matrix.length || row.some((value) => !Number.isFinite(value)))) throw codedError("INVALID_COVARIANCE", "Covariance must be a finite square matrix.");
  matrix.forEach((row, index) => row.forEach((value, column) => { if (Math.abs(value - matrix[column][index]) > 1e-12) throw codedError("INVALID_COVARIANCE", "Covariance must be symmetric."); }));
}
function codedError(code, message) { const error = new Error(message); error.code = code; return error; }
