/**
 * JSON — the tool that turns "why is this broken" into a line and a column.
 *
 * Three answers, one input: the formatted document, the minified one, and the
 * TypeScript interfaces a sample implies. Everything is computed on the keystroke
 * (there is no Run button, because a Run button implies the work is expensive),
 * and the error case is a *position in your text*, not a parser's sentence.
 */
import { BracketsCurly } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { CodeBlock } from '@/components/ui/code-block';
import { Segmented } from '@/components/ui/segmented';
import { FormChip } from '@/components/ui/form-chip';
import { formatJson, jsonStats, jsonToTypeScript, minifyJson, parseJson } from '@/lib/bench/json';
import { toolById } from '@/lib/bench/tools';
import { spacing } from '@/theme';
import {
  CopyButton,
  ToolAnswer,
  ToolFailure,
  ToolInput,
  ToolNote,
  ToolRow,
  ToolSection,
} from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('json')!;

const SAMPLE = `{"project":"Devlofy","version":"0.6.0","private":true,"screens":["hub","repo","edit"],"owner":{"login":"1-Pankaj","id":7}}`;

type Answer = 'format' | 'minify' | 'types';

const INDENTS = ['2', '4'] as const;
type Indent = (typeof INDENTS)[number];

export function JsonTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const [input, setInput] = useState(initial ?? SAMPLE);
  const [answer, setAnswer] = useState<Answer>('format');
  const [indent, setIndent] = useState<Indent>('2');
  const [sortKeys, setSortKeys] = useState(false);

  const parsed = useMemo(() => parseJson(input), [input]);

  const output = useMemo(() => {
    if (!parsed.ok) return null;
    if (answer === 'types') {
      const name = typeof parsed.value === 'object' && parsed.value !== null ? 'Root' : 'Value';
      return jsonToTypeScript(parsed.value, name);
    }
    const result = answer === 'minify' ? minifyJson(input) : formatJson(input, { indent: Number(indent), sortKeys });
    return result.ok ? result.value : null;
  }, [parsed, input, answer, indent, sortKeys]);

  const stats = useMemo(() => (parsed.ok ? jsonStats(parsed.value) : null), [parsed]);

  return (
    <>
      <ToolInput
        label="JSON"
        value={input}
        onChangeText={setInput}
        placeholder={SAMPLE}
        minHeight={170}
      />

      <ToolRow>
        <Segmented
          options={[
            { value: 'format', label: 'Format' },
            { value: 'minify', label: 'Minify' },
            { value: 'types', label: 'Types' },
          ]}
          value={answer}
          onChange={(next) => setAnswer(next as Answer)}
        />
      </ToolRow>

      {answer !== 'types' ? (
        <ToolRow>
          <FormChip label="sort keys" active={sortKeys} onPress={() => setSortKeys((on) => !on)} />
          {INDENTS.map((option) => (
            <FormChip
              key={option}
              label={`${option} spaces`}
              active={indent === option}
              onPress={() => setIndent(option)}
            />
          ))}
        </ToolRow>
      ) : null}

      {!parsed.ok && input.trim().length > 0 ? (
        <ToolFailure
          title="That is not valid JSON"
          message={
            parsed.error.line === null
              ? parsed.error.message
              : `Line ${parsed.error.line}, column ${parsed.error.column}: ${parsed.error.message}`
          }
        />
      ) : null}

      {parsed.ok && output !== null ? (
        <ToolAnswer
          label={answer === 'types' ? 'TypeScript' : answer === 'minify' ? 'One line' : 'Formatted'}
          text={output}>
          <CodeBlock
            code={output}
            language={answer === 'types' ? 'code' : 'json'}
            showLineNumbers={answer === 'types'}
          />
        </ToolAnswer>
      ) : null}

      {stats ? (
        <ToolSection label="Shape">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
            <ToolNote>
              {stats.keys} key{stats.keys === 1 ? '' : 's'} · {stats.nodes} value
              {stats.nodes === 1 ? '' : 's'} · depth {stats.depth} · {stats.bytes} bytes
            </ToolNote>
          </View>
        </ToolSection>
      ) : null}

      {parsed.ok && output ? (
        <SaveSnippetPanel
          tool={TOOL} snippetId={snippetId}
          body={output}
          language={answer === 'types' ? 'typescript' : 'json'}
          suggestedTitle="JSON · formatted"
        />
      ) : null}

      <ToolRow>
        <AppButton
          label="Reset to the example"
          variant="text"
          icon={BracketsCurly}
          onPress={() => {
            setInput(SAMPLE);
            setAnswer('format');
          }}
        />
        {input.length > 0 ? <CopyButton text={input} label="Copy input" /> : null}
      </ToolRow>
    </>
  );
}
