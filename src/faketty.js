// Module API

function applyFaketty(code, {faketty}) {
  // eslint-disable-next-line
  code = `'${code.replace(/'/g, `'\\''`)}'`
  return faketty ? `script -qefc ${code}` : code
}


// System

module.exports = {
  applyFaketty,
}
