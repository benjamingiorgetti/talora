---
name: refactor
description: "Intelligently refactor and improve code quality. Systematic approach: analyze, test, refactor incrementally, verify. Covers design patterns, performance, error handling, and documentation."
user_invocable: true
argument_hint: "[file, module, or description of what to refactor]"
---

# Intelligently Refactor and Improve Code Quality

Follow this systematic approach to refactor code: **$ARGUMENTS**

## Instructions

### 1. Pre-Refactoring Analysis
- Identify the code that needs refactoring and the reasons why
- Understand the current functionality and behavior completely
- Review existing tests and documentation
- Identify all dependencies and usage points

### 2. Test Coverage Verification
- Ensure comprehensive test coverage exists for the code being refactored
- If tests are missing, write them BEFORE starting refactoring
- Run all tests to establish a baseline
- Document current behavior with additional tests if needed

### 3. Refactoring Strategy
- Define clear goals (performance, readability, maintainability)
- Choose appropriate techniques:
  - Extract Method/Function
  - Extract Class/Component
  - Rename Variable/Method
  - Move Method/Field
  - Replace Conditional with Polymorphism
  - Eliminate Dead Code
- Plan the refactoring in small, incremental steps

### 4. Incremental Refactoring
- Make small, focused changes one at a time
- Run tests after each change to ensure nothing breaks
- Commit working changes frequently with descriptive messages
- Use IDE refactoring tools when available for safety

### 5. Code Quality Improvements
- Improve naming conventions for clarity
- Eliminate code duplication (DRY principle)
- Simplify complex conditional logic
- Reduce method/function length and complexity
- Improve separation of concerns

### 6. Performance Optimizations
- Identify and eliminate performance bottlenecks
- Optimize algorithms and data structures
- Reduce unnecessary computations
- Improve memory usage patterns

### 7. Design Pattern Application
- Apply appropriate design patterns where beneficial
- Improve abstraction and encapsulation
- Enhance modularity and reusability
- Reduce coupling between components

### 8. Error Handling Improvement
- Standardize error handling approaches
- Improve error messages and logging
- Add proper exception handling
- Enhance resilience and fault tolerance

### 9. Verification
- Run full test suite to ensure no regressions
- Run type-checking (`tsc --noEmit` for TypeScript)
- Test integration with dependent systems
- Verify all functionality works as expected
- Test edge cases and error scenarios

### 10. Summary
- Review all changes for quality and consistency
- Ensure refactoring goals were achieved
- Document benefits and rationale for changes made
- Note any breaking changes or new patterns introduced

## Key Principle

Refactoring should preserve external behavior while improving internal structure. Always prioritize safety over speed, and maintain comprehensive test coverage throughout the process.
