const lodahs = require('lodash')


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

  get is_root() {
    return !this._parent
  }

  // TODO: continue

    get parents() {
        parents = []
        task = self
        while true:
            if not task.parent:
                break
            parents.append(task.parent)
            task = task.parent
        return list(reversed(parents))
    }

    get qualified_name() {
        names = []
        for parent in (this.parents + [self]):
            if parent.name:
                names.append(parent.name)
        return ' '.join(names)
    }

    get flatten_setup_tasks() {
        tasks = []
        for parent in this.parents:
            for task in parent.childs:
                if task is self:
                    break
                if task in this.parents:
                    break
                if task.type == 'variable':
                    tasks.append(task)
        return tasks
    }

    get flatten_general_tasks() {
        tasks = []
        for task in this.childs or [self]:
            if task.composite:
                tasks.extend(task.flatten_general_tasks)
                continue
            tasks.append(task)
        return tasks
    }

    get flatten_childs_with_composite() {
        tasks = []
        for task in this.childs:
            tasks.append(task)
            if task.composite:
                tasks.extend(task.flatten_childs_with_composite)
        return tasks
    }

    find_child_tasks_by_name(name) {
        tasks = []
        for task in this.flatten_general_tasks:
            if task.name == name:
                tasks.append(task)
        return tasks
    }

    find_child_task_by_abbrevation(abbrevation) {
        letter = abbrevation[0]
        abbrev = abbrevation[1:]
        for task in this.childs:
            if task.name.startswith(letter):
                if abbrev:
                    return task.find_child_task_by_abbrevation(abbrev)
                return task
        return null
    }

    run(argv) {
        commands = []

        // Delegate by name
        if len(argv) > 0:
            for task in this.childs:
                if task.name == argv[0]:
                    return task.run(argv[1:])

                      // Delegate by abbrevation
        if len(argv) > 0:
            if this.is_root:
                task = this.find_child_task_by_abbrevation(argv[0])
                if task:
                    return task.run(argv[1:])

                      // Root task
        if this.is_root:
            if len(argv) > 0 and argv not in [['?'], ['!']]:
                message = 'Task "%s" not found' % argv[0]
                helpers.print_message('general', message=message)
                exit(1)
            _print_help(self, self)
            return true

            // Prepare filters
        filters = {'pick': [], 'enable': [], 'disable': []}
        for name, prefix in [['pick', '='], ['enable', '+'], ['disable', '-']]:
            for arg in list(argv):
                if arg.startswith(prefix):
                    childs = this.find_child_tasks_by_name(arg[1:])
                    if childs:
                        filters[name].extend(childs)
                        argv.remove(arg)

                        // Detect help
        help = false
        if argv == ['?']:
            argv.pop()
            help = true

            // Collect setup commands
        for task in this.flatten_setup_tasks:
            command = Command(task.qualified_name, task.code, variable=task.name)
            commands.append(command)

            // Collect general commands
        for task in this.flatten_general_tasks:
            if task is not self and task not in filters['pick']:
                if task.optional and task not in filters['enable']:
                    continue
                if task in filters['disable']:
                    continue
                if filters['pick']:
                    continue
            variable = task.name if task.type == 'variable' else null
            command = Command(task.qualified_name, task.code, variable=variable)
            commands.append(command)

            // Normalize arguments
        arguments_index = null
        for index, command in enumerate(commands):
            if '$RUNARGS' in command.code:
                if not command.variable:
                    arguments_index = index
                    continue
            if arguments_index is not null:
                command.code = command.code.replace('$RUNARGS', '')

            // Provide arguments
        if arguments_index is null:
            for index, command in enumerate(commands):
                if not command.variable:
                    command.code = '%s $RUNARGS' % command.code
                    break

                // Create plan
        plan = Plan(commands, this.type)

          // Show help
        if help:
            task = self if len(this.parents) < 2 else this.parents[1]
            selected_task = self
            _print_help(task, selected_task, plan, filters)
            exit()

            // Execute commands
        plan.execute(argv,
            quiet=this.quiet,
            streamline=this.options.get('streamline'))

        return true
    }

    complete(argv) {

      // Delegate by name
        if len(argv) > 0:
            for task in this.childs:
                if task.name == argv[0]:
                    task.complete(argv[1:])

                      // Autocomplete
        for child in this.childs:
            if child.name:
                print(child.name)

        return true
    }

}


// Internal

function _print_help(task, selected_task, plan=null, filters=null) {

  // General
    helpers.print_message('general', message=task.qualified_name)
    helpers.print_message('general', message='\n---')
    if task.desc:
        helpers.print_message('general', message='\nDescription\n')
        print(task.desc)

  // Vars
    header = false
    for child in [task] + task.flatten_childs_with_composite:
        if child.type == 'variable':
            if not header:
                helpers.print_message('general', message='\nVars\n')
                header = true
            print(child.qualified_name)

  // Tasks
    header = false
    for child in [task] + task.flatten_childs_with_composite:
        if not child.name:
            continue
        if child.type == 'variable':
            continue
        if not header:
            helpers.print_message('general', message='\nTasks\n')
            header = true
        message = child.qualified_name
        if child.optional:
            message += ' (optional)'
        if filters:
            if child in filters['pick']:
                message += ' (picked)'
            if child in filters['enable']:
                message += ' (enabled)'
            if child in filters['disable']:
                message += ' (disabled)'
        if child is selected_task:
            message += ' (selected)'
            helpers.print_message('general', message=message)
        else:
            print(message)

  // Execution plan
    if plan:
        helpers.print_message('general', message='\nExecution Plan\n')
        print(plan.explain())

}


// System

module.exports = {
  Task,
}
