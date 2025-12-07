# CRITICAL PROJECT GUIDELINES

## Operating System Commands
**CRITICAL: This project operates in a Windows environment.** All shell commands executed via `run_shell_command` MUST use Windows-native commands (e.g., `dir`, `copy`, `del`, `move`) or PowerShell cmdlets (e.g., `Get-ChildItem`, `Copy-Item`, `Remove-Item`, `Move-Item`). **DO NOT use Linux/Unix-based commands** such as `ls`, `cp`, `rm`, or `mv`, as they will fail.

## Refactoring Plan Adherence
Always prioritize and strictly adhere to the instructions and phases outlined in the `@REFACTOR_PLAN.md` file. All tasks related to form management migration must be executed according to this plan.

## BBCodeVersion Deprecation
**CRITICAL WARNING: The `bbCodeVersion` concept is deprecated and considered legacy. IT MUST BE AVOIDED AT ALL COSTS IN NEW CODE OR MODIFICATIONS.** Prioritize using `selectedForm.name` or other dynamic form properties from Firebase instead. Do NOT introduce or rely on `bbCodeVersion` under any circumstances.

## `cb:variable` Formatting in `src/components/Admin/AddFormModal.jsx`
When generating or modifying BBCode within `src/components/Admin/AddFormModal.jsx` that uses `{{cb:variable}}`, always ensure the output format adheres to `[cb:variable]TEXT` with no space between `[cb:variable]` and the subsequent text. **NEVER** use `[cb:variable] Text` (with a space).

If the Agent (Gemini) fails to replace blocks or takes significant time (over 5 minutes of thinking), stop the operation and inform the user of what block needs to be replaced.

# GRIP (Grep-on-Replace-Interrupt Protocol)



**Rule:** This protocol is a critical safeguard against common `replace` tool failures,

such as those caused by file state desynchronization or ambiguous matches,

as documented in gemini-cli issue [https://github.com/google-gemini/gemini-cli/issues/1028](https://github.com/google-gemini/gemini-cli/issues/1028).



**Goal:** To perform code modifications robustly with greater pre-emptive checks and clearer fallback paths, while providing the user with more control.



## The Revised Protocol



1.  **Pre-check for `replace` viability**:

    *   Before calling `replace`, use `Select-String` to count occurrences of `old_string`.

    *   **If `count == 0`**: Immediately assume `old_string` is absent. Proceed to **Scenario C**.

    *   **If `count > 1`**: Inform me (the agent) that `old_string` is ambiguous. Proceed to **Scenario A (Direct PowerShell)**.

    *   **If `count == 1`**: Proceed to **Attempt Standard `replace`**.



2.  **Attempt Standard `replace`**: Call the `replace` tool.

    *   **If `replace` succeeds**: Done.

    *   **If `replace` fails (but `count` was 1)**: This is unexpected. Re-verify `old_string` presence with `Select-String`.

        *   **If `Select-String` still finds 1 occurrence**: It's a `replace` tool internal issue. Proceed to **Scenario A (Direct PowerShell)**.

        *   **If `Select-String` now finds 0 occurrences**: The file state changed unexpectedly. Proceed to **Scenario C**.

        *   **If `Select-String` now finds >1 occurrences**: The file state changed unexpectedly. Proceed to **Scenario A (Direct PowerShell)**.



3.  **Scenario A: Direct PowerShell Replacement (for ambiguous or `replace` tool issues)**

    *   **Diagnosis**: The `old_string` exists (possibly ambiguously), but the `replace` tool is unsuitable or failed.

    *   **My Action**:

        1.  Acknowledge the issue (ambiguity or `replace` failure).

        2.  Use `Select-String` with `context` (e.g., 5 lines before/after) to fetch a detailed surrounding snippet of the `old_string`. Present this snippet to me.

        3.  Formulate a precise PowerShell command using `Get-Content | ForEach-Object { $_ -replace 'old_pattern', 'new_pattern' } | Set-Content` or equivalent.

        4.  **PROPOSE THIS POWERSHELL COMMAND TO THE USER FOR CONFIRMATION**. Explain why it's necessary and its potential impact.

        5.  **Execute the PowerShell command ONLY IF CONFIRMED BY THE USER.**

        6.  After execution, re-read the file and verify `new_string` presence.



4.  **Scenario C: `old_string` Not Found (Pre-check or Post-failure)**

    *   **Diagnosis**: The `old_string` was not found in initial pre-check, or it disappeared after a `replace` attempt. This implies the change might be applied already or the file state is severely out of sync.

    *   **My Action**:

        1.  State clearly that `old_string` was not found.

        2.  **Hypothesis**: "It is likely the change has already been applied, possibly by a previous step or manual edit."

        3.  Verify this hypothesis by using `Select-String` to search for `new_string`.

        4.  **If `new_string` is found**: Conclude the task is complete. No further action needed for this specific `replace`.

        5.  **If `new_string` is NOT found**: Report this anomaly: "Neither the original string nor the intended new string could be found. This indicates an unexpected state in the file." Ask for user clarification or provide raw file content for inspection.

# AGENT EXECUTION CLARITY

## Thought vs. Tool Execution
Ensure that internal planning (`thought` blocks) is always distinct from intended actions (tool calls). Never output internal thought blocks as direct responses to the user or as tool calls. Always wrap tool calls in the appropriate FC2.0 format.
