const {applyFaketty} = require('./faketty')


// Module API

def execute_sync(commands, environ, quiet=False):
    for command in commands:

        # Log process
        if not command.variable and not quiet:
            sys.stdout.write('[run] Launched "%s"\n' % command.code)
            sys.stdout.flush()

        # Create process
        stdout = None if not command.variable else subprocess.PIPE
        stderr = None if not command.variable else subprocess.STDOUT
        process = subprocess.Popen(command.code,
            shell=True, env=environ, stdout=stdout, stderr=stderr)

        # Wait process
        output, _ = process.communicate()
        if process.returncode != 0:
            message = '[run] Command "%s" has failed' % command.code
            helpers.print_message('general', message=message)
            exit(1)
        if command.variable:
            environ[command.variable] = output.decode().strip()


def execute_async(commands, environ, multiplex=False, quiet=False, streamline=False):

    # Launch processes
    processes = []
    color_iterator = helpers.iter_colors()
    for command in commands:

        # Log process
        if not quiet:
            sys.stdout.write('[run] Launched "%s"\n' % command.code)
            sys.stdout.flush()

        # Create process
        process = subprocess.Popen(
            _apply_faketty(command.code, streamline=streamline), bufsize=64, env=environ,
            shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

        # Create listener
        listener = select.poll()
        listener.register(process.stdout, select.POLLIN)

        # Register process
        color = next(color_iterator)
        processes.append((command, process, listener, color))

    # Wait processes
    while processes:
        for index, (command, process, listener, color) in enumerate(processes):

            # Process output
            if multiplex or index == 0:
                while listener.poll(1000):
                    line = process.stdout.readline()
                    if not line:
                        break
                    _print_line(line, command.name, color,
                        multiplex=multiplex, quiet=quiet)

            # Process finish
            if process.poll() is not None:
                if process.returncode != 0:
                    for line in process.stdout.readlines():
                        _print_line(line, command.name, color,
                            multiplex=multiplex, quiet=quiet)
                    message = '[run] Command "%s" has failed' % command.code
                    helpers.print_message('general', message=message)
                    exit(1)
                if index == 0:
                    processes.pop(index)
                    break


// Internal

def _print_line(line, name, color, multiplex=False, quiet=False):
    line = line.replace(b'\r\n', b'\n')
    if multiplex and not quiet:
        click.echo(click.style('%s | ' % name, fg=color), nl=False)
    buffer = getattr(sys.stdout, 'buffer', sys.stdout)
    buffer.write(line)
    sys.stdout.flush()


// System

module.exports = {
  executeSync,
  executeAsync,
}
