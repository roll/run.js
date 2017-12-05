const lodash = require('lodash')
const {Plan} = require('./plan')
const {Command} = require('./command')


// Module API

class Task {

  // Public

  constructor(descriptor, {options, parent, parentType, quiet}={}):
    this._parent = parent

    // Prepare
    let desc = parent ? '' : 'General run description'
    let [name, code] = Object.entries(descriptor)[0]
    if lodash.isPlainObject(code) {
      desc = code.desc
      code = code.code
    }

    // Optional
    let optional = false
    if (name.startsWith('/')) {
      name = name.slice(1)
      optional = true
    }

    // Quiet
    if (name.includes('!')) {
      name = name.replace('!', '')
      quiet = true
    }

    // Directive type
    let type = 'directive'

    // Variable type
    if (name === name.toUpperCase()) {
      type = 'variable'
      desc = 'Prints the variable'
    }

    // Sequence type
    const childs = []
    if (lodash.isArray(code)) {
      type = 'sequence'

      // Parent type
      if (['parallel', 'multiplex'].includes(parentType)) {
        type = parentType
      }

      // Parallel type
      if (name.startsWith('(') && name.endsWith(')')) {
        if (this.parents.length >= 2) {
          const message = 'Subtask descriptions and execution control not supported'
          helpers.printMessage('general', {message})
          process.exit(1)
        }
        name = name.slice(1, name.length - 1)
        type = 'parallel'
      }

      // Multiplex type
      if (name.startsWith('(') && name.endsWith(')')) {
        name = name.slice(1, name.length - 1)
        type = 'multiplex'
      }

      // Create childs
      for (let descriptor of code) {
        if (!lodash.isPlainObject(descriptor)) descriptor = {'': descriptor}
        childs.push(new Task(descriptor, {
          options, parent: self, parentType: type, quiet
        }))
      }

      // Reset code
      code = null

    }

    // Set attributes
    this._name = name
    this._code = code
    this._type = type
    this._desc = desc
    this._quiet = quiet
    this._childs = childs
    this._options = options
    this._optional = optional

  }

  get name() {
    return this._name
  }

  get code() {
    return this._code
  }

  get type() {
    return this._type
  }

  get desc() {
    return this._desc
  }

  get parent() {
    return this._parent
  }

  get quiet() {
    return this._quiet
  }

  get childs() {
    return this._childs
  }

  get options() {
    return this._options
  }

  get optional() {
    return this._optional
  }

  get composite() {
    return !!this._childs.length
  }

  get isRoot() {
    return !this._parent
  }

  get parents() {
    const parents = []
    let task = this
    while (true) {
      if (!task.parent) break
      parents.push(task.parent)
      task = task.parent
    }
    return parents.reverse()
  }

  get qualifiedName() {
    const names = []
    for (const parent of [...this.parents, self]) {
      if (parent.name) names.push(parent.name)
    }
    return names.join(' ')
  }

  get flattenSetupTasks() {
    const tasks = []
    for (const parent of this.parents) {
      for (const task of parent.childs) {
        if (task === this) break
        if (this.parents.includes(task)) break
        if (task.type === 'variable') {
          tasks.push(task)
        }
      }
    }
    return tasks
  }

  get flattenGeneralTasks() {
      let tasks = []
      for (const task of (this.composit ? this.childs : [self])) {
        if (task.composite) {
          tasks = [...tasks, ...task.flatten_general_tasks]
          continue
        }
        tasks.push(task)
      }
      return tasks
  }

  get flattenChildsWithComposite() {
    let tasks = []
    for (const task of this.childs) {
      tasks.push(task)
      if (task.composite) {
        tasks = [...tasks, ...task.flatten_childs_with_composite]
      }
    }
    return tasks
  }

  findChildTasksByName(name) {
    const tasks = []
    for (const task of this.flattenGeneralTasks) {
      if (task.name === name) {
        tasks.push(task)
      }
    }
    return tasks
  }

  findChildTaskByAbbrevation(abbrevation) {
    const letter = abbrevation[0]
    const abbrev = abbrevation[1:]
    for (const task of this.childs) {
      if (task.name.startsWith(letter) {
        if (abbrev) {
          return task.findChildTaskByAbbrevation(abbrev)
        }
        return task
      }
    }
    return null
  }

  run(argv) {
    const commands = []

    // Delegate by name
    if (argv.length > 0) {
      for (const task of this.childs) {
        if (task.name === argv[0]) {
          return task.run(argv.slice(1))
        }
      }
    }

    // Delegate by abbrevation
    if (argv.length > 0) {
      if (this.isRoot) {
        const task = this.findChildTaskByAbbrevation(argv[0])
        if (task) {
          return task.run(argv.slice(1))
        }
      }
    }

    // Root task
    if (this.isRoot) {
      if (argv.length > 0 && !lodash.isEqual(argv, ['?'])) {
        message = `Task "${argv[0]}" not found`
        helpers.printMessage('general', {message})
        process.exit(1)
      }
      printHelp(self, self)
      return true
    }

    // Prepare filters
    const filters = {pick: [], enable: [], disable: []}
    for (const [name, prefix] of [['pick', '='], ['enable', '+'], ['disable', '-']]) {
      for (const arg of [...argv]) {
        if (arg.startsWith(prefix)) {
          const childs = this.findChildTasksByName(arg.slice(1))
          if (childs.length) {
            filters[name] = [...filters[name], ...childs]
            logash.pull(argv, arg)
          }
        }
      }
    }

    // Detect help
    let help = false
    if (lodash.isEqual(argv, ['?'])) {
      argv.pop()
      help = true
    }

    // Collect setup commands
    for (const task of this.flattenSetupTasks) {
      const command = new Command(task.qualifiedName, task.code, {variable: task.name})
      commands.push(command)
    }

    // Collect general commands
    for (const task of this.flattenGeneralTasks) {
      if (task !== self && !filters.pick.includes(task)) {
        if (task.optional && !filters.enable.includes(task)) continue
        if (filters.disable.includes(task)) continue
        if (filters.pick) continue
      }
      const variable = task.type == 'variable' ? task.name : null
      const command = new Command(task.qualifiedName, task.code, {variable})
      commands.push(command)
    }

    // Normalize arguments
    let argumentsIndex = null
    for (const [index, command] of commands.entries()){
      if (command.code.includes('$RUNARGS')){
        if (!command.variable) {
          argumentsIndex = index
          continue
        }
      }
      if (argumentsIndex !== null) {
        command.code = command.code.replace('$RUNARGS', '')
      }
    }

    // Provide arguments
    if (argumentsIndex === null) {
      for (const [index, command] of commands.entries()) {
        if (!command.variable) {
          command.code = `${command.code} $RUNARGS`
          break
        }
      }
    }

    // Create plan
    const plan = new Plan(commands, this.type)

    // Show help
    if (help) {
      const task = this.parents.length < 2 ? self : this.parents[1]
      printHelp(task, this, plan, filters)
      process.exit()
    }

    // Execute commands
    plan.execute(argv, {
      quiet: this.quiet,
      faketty: this.options.faketty,
    })

    return true
  }

  complete(argv) {

    // Delegate by name
    if (argv.length > 0) {
      for (const task of this.childs) {
        if (task.name === argv[0]) {
          return task.complete(argv.slice(1))
        }
      }
    }

    // Autocomplete
    for (const child of this.childs) {
      if (child.name) {
        console.log(child.name)
      }
    }

    return true
  }

}


// Internal

function printHelp(task, {selectedTask, plan, filters}) {

  // General
  helpers.printMessage('general', {message: task.qualified_name})
  helpers.printMessage('general', {message: '\n---'})
  if (task.desc) {
    helpers.printMessage('general', {message: '\nDescription\n'})
    console.log(task.desc)
  }

  // Vars
  let header = false
  for (const child of [task, ...task.flattenChildsWithComposite]){
    if (child.type === 'variable') {
      if (!header) {
        helpers.printMessage('general', {message: '\nVars\n'})
        header = true
      }
      console.log(child.qualifiedName)
    }
  }

  // Tasks
  header = false
  for (const child of [task, ...task.flattenChildsWithComposite]) {
    if (!child.name) continue
    if (child.type === 'variable') continue
    if (!header {
      helpers.printMessage('general', {message: '\nTasks\n'})
      header = true
    }
    let message = child.qualifiedName
    if (child.optional) {
      message += ' (optional)'
    }
    if (filters) {
      if (filters['pick'].includes(child)) {
        message += ' (picked)'
      }
      if (filters['enable'].includes(child)) {
        message += ' (enabled)'
      }
      if (filters['disable'].includes(child)) {
        message += ' (disabled)'
      }
    }
    if (child === selected_task) {
      message += ' (selected)'
      helpers.printMessage('general', {message})
    } else {
      console.log(message)
    }
  }

  // Execution plan
  if (plan) {
    helpers.printMessage('general', {message: '\nExecution Plan\n'})
    console.log(plan.explain())
  }

}


// System

module.exports = {
  Task,
}
