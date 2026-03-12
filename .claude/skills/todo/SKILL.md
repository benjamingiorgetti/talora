---
name: todo
description: "Manage project todos in todos.md file. Supports add, complete, remove, undo, list, due dates, and next task. Usage: /todo add \"task\" [date], /todo complete N, /todo list"
user_invocable: true
argument_hint: "[action] [task-description] | add | complete | remove | list | next | past due"
allowed_tools: "Read, Write, Edit"
---

# Project Todo Manager

Manage todos in a `todos.md` file at the root of your current project directory: **$ARGUMENTS**

## Usage Examples
- `/todo add "Fix navigation bug"`
- `/todo add "Fix navigation bug" tomorrow`
- `/todo complete 1`
- `/todo remove 2`
- `/todo list`
- `/todo undo 1`
- `/todo due 1 next week`
- `/todo next`
- `/todo past due`

## Instructions

You are a todo manager for the current project. When this command is invoked:

1. **Determine the project root** by looking for common indicators (.git, package.json, etc.)
2. **Locate or create** `todos.md` in the project root
3. **Parse the command arguments** to determine the action:
   - `add "task description"` - Add a new todo
   - `add "task description" [tomorrow|next week|4 days|June 9|12-24-2025|etc...]` - Add a new todo with the provided due date
   - `due N [tomorrow|next week|4 days|June 9|12-24-2025|etc...]` - Mark todo N with the due date provided
   - `complete N` - Mark todo N as completed and move from the ##Active list to the ##Completed list
   - `remove N` - Remove todo N entirely
   - `undo N` - Mark completed todo N as incomplete
   - `list [N]` or no args - Show all (or N number of) todos in a user-friendly format, with each todo numbered for reference
   - `past due` - Show all of the tasks which are past due and still active
   - `next` - Shows the next active task in the list, respecting Due dates if any. If not, show the first todo in the Active list

## Todo Format

Use this markdown format in todos.md:
```markdown
# Project Todos

## Active
- [ ] Task description here | Due: MM-DD-YYYY
- [ ] Another task

## Completed
- [x] Finished task | Done: MM-DD-YYYY
- [x] Another completed task | Due: MM-DD-YYYY | Done: MM-DD-YYYY
```

## Behavior
- Number todos when displaying (1, 2, 3...)
- Keep completed todos in a separate section
- Todos do not need to have Due Dates/Times
- Keep the Active list sorted descending by Due Date; tasks with Due Dates come before those without
- If todos.md doesn't exist, create it with the basic structure
- Show helpful feedback after each action
- Handle edge cases gracefully (invalid numbers, missing file, etc.)
- Dates saved in MM-DD-YYYY format
- Times only included if explicitly requested (e.g., `due N in 2 hours` -> MM-DD-YYYY @ HH:MM AM/PM)

Always be concise and helpful in responses.
