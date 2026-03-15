// @ts-nocheck
import { describe, it, expect } from 'bun:test';
import {
  CORE_TOOL_DEFINITIONS,
  isCoreToolName,
  isCoreToolImplementation,
  getCoreToolDefinition,
  applyCoreToolDefinition,
  buildDefaultCoreTools,
} from '../core-tool-registry';

describe('Core tool registry', () => {
  it('exports a non-empty array of definitions', () => {
    expect(CORE_TOOL_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('every tool has name, description, parameters, and implementation', () => {
    for (const tool of CORE_TOOL_DEFINITIONS) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.implementation).toBe('string');
    }
  });

  it('includes all expected core tools', () => {
    const names = CORE_TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toContain('google_calendar_check');
    expect(names).toContain('google_calendar_book');
    expect(names).toContain('google_calendar_reprogram');
    expect(names).toContain('google_calendar_cancel');
    expect(names).toContain('escalate');
  });

  it('isCoreToolName returns true for known names, false for unknown', () => {
    expect(isCoreToolName('google_calendar_check')).toBe(true);
    expect(isCoreToolName('escalate')).toBe(true);
    expect(isCoreToolName('fake_tool')).toBe(false);
    expect(isCoreToolName('')).toBe(false);
  });

  it('isCoreToolImplementation returns true for known implementations', () => {
    expect(isCoreToolImplementation('google_calendar_book')).toBe(true);
    expect(isCoreToolImplementation('unknown_impl')).toBe(false);
  });

  it('getCoreToolDefinition returns definition by name or implementation', () => {
    const byName = getCoreToolDefinition('escalate');
    expect(byName).not.toBeNull();
    expect(byName!.name).toBe('escalate');

    expect(getCoreToolDefinition('nonexistent')).toBeNull();
  });

  it('applyCoreToolDefinition stamps core definition on matching tool', () => {
    const tool = {
      id: 'tool-1',
      agent_id: 'agent-1',
      name: 'old_name',
      description: 'old desc',
      parameters: {},
      implementation: 'google_calendar_check',
      is_active: true,
      source: 'custom' as const,
      created_at: '2026-01-01',
    };

    const result = applyCoreToolDefinition(tool);
    expect(result.name).toBe('google_calendar_check');
    expect(result.source).toBe('core');
    expect(result.description).not.toBe('old desc');
  });

  it('applyCoreToolDefinition returns tool unchanged when not a core tool', () => {
    const tool = {
      id: 'tool-2',
      agent_id: 'agent-1',
      name: 'custom_tool',
      description: 'custom desc',
      parameters: {},
      implementation: 'custom_impl',
      is_active: true,
      source: 'custom' as const,
      created_at: '2026-01-01',
    };

    const result = applyCoreToolDefinition(tool);
    expect(result.name).toBe('custom_tool');
    expect(result.source).toBe('custom');
  });

  it('buildDefaultCoreTools returns tools with correct agent_id and source', () => {
    const tools = buildDefaultCoreTools('agent-123');
    expect(tools.length).toBe(CORE_TOOL_DEFINITIONS.length);
    for (const tool of tools) {
      expect(tool.agent_id).toBe('agent-123');
      expect(tool.source).toBe('core');
      expect(tool.is_active).toBe(true);
    }
  });
});
