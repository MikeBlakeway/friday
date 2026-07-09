# Basic Project Example

This example shows how a small project can store Friday memory in plain
Markdown and turn that memory into a planning prompt.

```txt
examples/basic-project/.friday/
  project.md
  architecture.md
  decisions.md
  design.md
  tasks.md
  notes.md
```

Friday reads the Markdown files in `.friday/`, skips files with no content, and
places the loaded context into the planning prompt. The prompt is then ready to
review, save, or pass to a model through a future provider workflow.

Try the same workflow from this directory:

```bash
friday plan "Add recipe sharing"
```

The [sample planning prompt output](./planning-output.md) shows the kind of
context Friday produces from the example memory.

The example uses fictional product context only. It is designed to be readable
in a portfolio or repository browser.
