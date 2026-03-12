---
name: architecture-review
description: "Comprehensive architecture review with design patterns analysis and improvement recommendations. Analyzes system structure, dependencies, scalability, and security architecture."
user_invocable: true
argument_hint: "[scope] | --modules | --patterns | --dependencies | --security"
allowed_tools: "Read, Glob, Grep, Bash"
---

# Architecture Review

Perform comprehensive system architecture analysis and improvement planning: **$ARGUMENTS**

## Task

Execute comprehensive architectural analysis with actionable improvement recommendations.

**Review Scope**: Use $ARGUMENTS to focus on specific modules, design patterns, dependency analysis, or security architecture.

## Architecture Analysis Framework

### 1. System Structure Assessment
- Map component hierarchy and identify architectural patterns
- Analyze module boundaries and assess layered design
- Review project structure: find key directories and entry points
- Check package dependencies and build configuration

### 2. Design Pattern Evaluation
- Identify implemented patterns (MVC, Repository, Factory, Observer, etc.)
- Assess pattern consistency across the codebase
- Detect anti-patterns (God objects, spaghetti code, tight coupling)
- Evaluate pattern effectiveness for the project's needs

### 3. Dependency Architecture
- Analyze coupling levels between modules
- Detect circular dependencies
- Evaluate dependency injection usage
- Assess architectural boundaries and layering

### 4. Data Flow Analysis
- Trace information flow through the system
- Evaluate state management approach
- Assess data persistence strategies
- Validate transformation patterns and serialization

### 5. Scalability & Performance
- Analyze horizontal/vertical scaling capabilities
- Evaluate caching strategies
- Assess bottlenecks (N+1 queries, blocking I/O, memory leaks)
- Review resource management and connection pooling

### 6. Security Architecture
- Review trust boundaries between components
- Assess authentication and authorization patterns
- Analyze data protection (encryption, sanitization)
- Evaluate input validation and output encoding

## Advanced Analysis

- Component testability and test coverage
- Configuration management (env vars, feature flags)
- Error handling patterns and resilience
- Monitoring and observability integration
- Extensibility and plugin architecture

## Output Format

Produce a structured report:

```
## Architecture Overview
- System diagram / component map
- Key architectural decisions identified

## Strengths
- What's well-designed and maintainable

## Issues Found
### Critical
- [file:line] Description and impact

### High
- [file:line] Description and impact

### Medium
- [file:line] Description and impact

## Recommendations
### Quick Wins (< 1 day)
### Medium-term (1-5 days)
### Strategic (1+ weeks)

## Refactoring Roadmap
- Prioritized steps with dependencies
```
