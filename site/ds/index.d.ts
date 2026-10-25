// Dukecodes Design System: component props (documentation). Global: window.Dukecodes. Requires React 18.
import type { ReactNode } from 'react';

export interface ButtonProps { children: ReactNode; onClick?: () => void; variant?: 'default' | 'primary' | 'amber'; size?: 'sm'; type?: 'button' | 'submit'; disabled?: boolean; pressed?: boolean; ariaLabel?: string; /** keeps focus and ignores clicks */ ariaDisabled?: boolean; title?: string; className?: string }
export interface ChipProps { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'teal' | 'violet'; dot?: boolean; title?: string; className?: string }
export interface PanelProps { children?: ReactNode; eyebrow?: string; as?: string; padded?: boolean; className?: string }
export interface CalloutProps { children: ReactNode; kind?: 'warn' | 'gate' | 'adapt' | 'unverified'; label?: string; /** announce when inserted after load */ live?: boolean }
export interface CodeBlockProps { code: string; where?: string }
export interface StatTileProps { value: ReactNode; label: string }
export interface StageCardProps { n: number; title: string; progress?: number; state?: 'idle' | 'active' | 'done'; status?: string; /** renders a button; otherwise static */ onClick?: () => void }
export interface SegmentedProps { label: string; options: { value: string; label: string }[]; value: string; onChange?: (value: string) => void }
export interface StepCardProps { id: string; title: string; chips?: ReactNode; children?: ReactNode; defaultOpen?: boolean; defaultDone?: boolean; onDone?: (done: boolean) => void }

export interface ConsoleScenario { name: string; stages: string[]; /** line 0 is the command; line k reports stage k-1 */ lines: string[]; /** index of the failing stage, or null */ fail: number | null; why?: string }
export interface LiveConsoleProps { scenarios?: ConsoleScenario[]; /** false once it shows real runs */ demo?: boolean }
export interface SwarmStage { t: string; steps?: string[] }
export interface SwarmBoardProps { stages?: (SwarmStage | string)[]; /** real progress 0-100 per stage; turns the simulation off */ progress?: number[]; concurrency?: number; tickMs?: number; autoplay?: boolean; /** false hides the 'demo data' label */ demo?: boolean }
export type LinkKind = '' | 'two5' | 'ten' | 'ts' | 'lab' | 'pwr';
export interface TopoNode { x: number; y: number; w?: number; h?: number; l: string; s?: string; k?: 'net' | 'ops' | 'media' | 'dev' | 'core' | 'sec'; buy?: boolean; live?: boolean; i?: string }
export interface TopoPhase { id: string; label?: string; note?: string; hide?: string[]; move?: Record<string, Partial<TopoNode>>; links: [string, string, LinkKind?][] }
export interface TopoTrace { id: string; t: string; phase?: string; path: string[]; hops: string[]; blockAt?: number }
export interface TopologyTraceProps { data?: { viewBox?: [number, number]; nodes: Record<string, TopoNode>; phases: TopoPhase[]; traces?: TopoTrace[]; zones?: { x: number; y: number; w: number; h: number; l: string; tone?: 'red' }[] }; phase?: string; selected?: string; ambient?: boolean }
export interface GateSimulatorProps { gates?: { id: string; l: string; t: string }[]; attacks?: { id: string; l: string; g: string | null; why: string; fix: string }[] }
export interface TerminalReplayProps { script: ({ cmd: string } | { out: string })[]; prompt?: string; title?: string }
export interface FlashcardsProps { cards: { q: string; a: string; tag?: string }[]; title?: string }
export interface CommandPaletteItem { id?: string; kind?: string; title: string; sub?: string }
export interface CommandPaletteProps { items: CommandPaletteItem[]; onSelect?: (item: CommandPaletteItem) => void; placeholder?: string; label?: string; max?: number; /** false on every palette but one per page */ hotkey?: boolean }
export interface GlossaryTermProps { term: string; def: string; children?: ReactNode }
export interface ProgressRingProps { value: number; label?: string; sub?: string; size?: number; stroke?: number }
export interface BentoCardProps { span?: 2 | 3 | 4 | 6; eyebrow?: string; stat?: ReactNode; title?: string; children?: ReactNode; tone?: 'amber' | 'teal' | 'green' | 'violet'; /** http(s), mailto or relative only */ href?: string; /** opt-in; default opens in the same tab */ newTab?: boolean }

export declare const Button: (p: ButtonProps) => JSX.Element;
export declare const Chip: (p: ChipProps) => JSX.Element;
export declare const Panel: (p: PanelProps) => JSX.Element;
export declare const Callout: (p: CalloutProps) => JSX.Element;
export declare const CodeBlock: (p: CodeBlockProps) => JSX.Element;
export declare const StatTile: (p: StatTileProps) => JSX.Element;
export declare const StageCard: (p: StageCardProps) => JSX.Element;
export declare const Segmented: (p: SegmentedProps) => JSX.Element;
export declare const StepCard: (p: StepCardProps) => JSX.Element;
export declare const LiveConsole: (p: LiveConsoleProps) => JSX.Element;
export declare const SwarmBoard: (p: SwarmBoardProps) => JSX.Element;
export declare const TopologyTrace: (p: TopologyTraceProps) => JSX.Element;
export declare const GateSimulator: (p: GateSimulatorProps) => JSX.Element;
export declare const TerminalReplay: (p: TerminalReplayProps) => JSX.Element;
export declare const Flashcards: (p: FlashcardsProps) => JSX.Element;
export declare const CommandPalette: (p: CommandPaletteProps) => JSX.Element;
export declare const GlossaryTerm: (p: GlossaryTermProps) => JSX.Element;
export declare const ProgressRing: (p: ProgressRingProps) => JSX.Element;
export declare const BentoCard: (p: BentoCardProps) => JSX.Element;
/** Confetti burst inside el in the system colours; no-op under reduced motion. */
export declare const celebrate: (el: HTMLElement) => void;
/** Copy text; resolves true/false and never rejects. */
export declare const copyText: (text: string) => Promise<boolean>;
