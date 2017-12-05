// Module API

class Command {

  // Public

  constructor(name, code, {variable}) {
    this._name = name
    this._code = code
    this._variable = variable
  }

  get name() {
    return this._name
  }

  get code() {
    return this._code
  }

  set code(value) {
    this._code = value
  }

  get variable() {
    return this._variable
  }

}


// System

module.exports = {
  Command,
}
