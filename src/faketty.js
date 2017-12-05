// Module API

function applyFaketty(code, {faketty}) {
  return faketty ? `script -qefc ${code}` : code
}


// System

module.exports = {
  applyFaketty,
}
