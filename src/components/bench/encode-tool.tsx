/**
 * Encode — base64 (standard and url-safe), percent-encoding, HTML entities.
 *
 * The direction is a switch rather than two boxes, because the answer for the
 * other direction is almost never what you were looking at. Decoding reports
 * what it *skipped*: `base64ToBytes` is deliberately tolerant (it reads GitHub's
 * wrapped output and URL-safe input), and a tolerant decoder that stays silent
 * about junk is the one thing a decoder must not do.
 */
import { ArrowsLeftRight } from 'phosphor-react-native';
import { useMemo, useState } from 'react';

import { AppButton } from '@/components/ui/app-button';
import { CodeBlock } from '@/components/ui/code-block';
import { FormChip } from '@/components/ui/form-chip';
import { Segmented } from '@/components/ui/segmented';
import { CODECS, decode, encode, type Codec } from '@/lib/bench/encode';
import { toolById } from '@/lib/bench/tools';
import { ToolAnswer, ToolFailure, ToolInput, ToolRow } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('encode')!;

const SAMPLES: Record<Codec, string> = {
  base64: 'nothing leaves this device',
  base64url: 'nothing leaves this device',
  url: 'q=devlofy offline-first&page=2',
  html: '5 < 6 && "quoted" — a lot',
};

type Direction = 'encode' | 'decode';

export function EncodeTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const [codec, setCodec] = useState<Codec>('base64');
  const [direction, setDirection] = useState<Direction>('encode');
  const [input, setInput] = useState(initial ?? SAMPLES.base64);

  const result = useMemo(
    () => (direction === 'encode' ? encode(input, codec) : decode(input, codec)),
    [input, codec, direction],
  );

  const answer = result.ok ? result.text : null;
  const note = result.ok ? result.note : null;

  return (
    <>
      <ToolRow>
        <Segmented
          options={CODECS.map((info) => ({ value: info.id, label: info.label }))}
          value={codec}
          onChange={(next) => setCodec(next as Codec)}
        />
      </ToolRow>

      <ToolRow>
        <FormChip
          label="encode"
          active={direction === 'encode'}
          onPress={() => setDirection('encode')}
        />
        <FormChip
          label="decode"
          active={direction === 'decode'}
          onPress={() => setDirection('decode')}
        />
      </ToolRow>

      <ToolInput
        label={direction === 'encode' ? 'Text' : `${CODECS.find((info) => info.id === codec)?.label} to decode`}
        value={input}
        onChangeText={setInput}
        placeholder={SAMPLES[codec]}
        minHeight={130}
      />

      {!result.ok && input.trim().length > 0 ? (
        <ToolFailure title="Could not decode that" message={result.message} />
      ) : null}

      {answer !== null && answer.length > 0 ? (
        <ToolAnswer label={direction === 'encode' ? 'Encoded' : 'Decoded'} text={answer} note={note ?? undefined}>
          <CodeBlock code={answer} highlight={false} showLineNumbers={false} />
        </ToolAnswer>
      ) : null}

      <ToolRow>
        <AppButton
          label={direction === 'encode' ? 'Decode instead' : 'Encode instead'}
          variant="tonal"
          icon={ArrowsLeftRight}
          onPress={() => {
            if (answer !== null) setInput(answer);
            setDirection((current) => (current === 'encode' ? 'decode' : 'encode'));
          }}
        />
        <AppButton
          label="Example"
          variant="text"
          onPress={() => setInput(SAMPLES[codec])}
        />
      </ToolRow>

      {answer ? (
        <SaveSnippetPanel
          tool={TOOL} snippetId={snippetId}
          body={answer}
          language="plain"
          suggestedTitle={`${CODECS.find((info) => info.id === codec)?.label ?? 'Encoded'} · ${direction}`}
        />
      ) : null}
    </>
  );
}
