/**
 * SQL — re-indent a statement, and nothing else.
 *
 * The tool says what it does before you trust it with a query: keywords get
 * upper-cased and lines get broken at clauses, joins and boolean operators, and
 * strings, quoted identifiers and comments are copied through untouched. It is
 * not a parser and does not validate SQL — so a query it cannot read comes back
 * looking reasonable rather than throwing an error it cannot justify.
 */
import { useMemo, useState } from 'react';

import { AppButton } from '@/components/ui/app-button';
import { CodeBlock } from '@/components/ui/code-block';
import { FormChip } from '@/components/ui/form-chip';
import { formatSql } from '@/lib/bench/sql';
import { toolById } from '@/lib/bench/tools';
import { ToolAnswer, ToolInput, ToolNote, ToolRow, ToolSection } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('sql')!;

const SAMPLE = `select t.id, t.title, p.name as project, count(s.id) as blocks, sum(extract(epoch from s.ended_at - s.started_at))/3600 as hours
from tasks t
left join projects p on p.id = t.project_id
left join sessions s on s.task_id = t.id and s.deleted_at is null
where t.deleted_at is null and t.status != 'done' and (p.name like '%client%' or t.title ilike '%invoice%')
group by t.id, t.title, p.name
order by hours desc, t.title asc
limit 20;`;

export function SqlTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const [input, setInput] = useState(initial ?? SAMPLE);
  const [uppercase, setUppercase] = useState(true);

  const result = useMemo(() => formatSql(input, { uppercase }), [input, uppercase]);
  const hasOutput = input.trim().length > 0;

  return (
    <>
      <ToolInput label="SQL" value={input} onChangeText={setInput} placeholder={SAMPLE} minHeight={190} />

      <ToolRow>
        <FormChip
          label="upper-case keywords"
          active={uppercase}
          onPress={() => setUppercase((on) => !on)}
        />
        <AppButton label="Example" variant="text" onPress={() => setInput(SAMPLE)} />
      </ToolRow>

      <ToolNote>
        A re-indenter, not a parser: it changes keyword case and line breaks, and copies strings,
        quoted identifiers and comments through untouched. It does not validate the query.
      </ToolNote>

      {hasOutput ? (
        <>
          <ToolAnswer
            label={`Formatted · ${result.statements} statement${result.statements === 1 ? '' : 's'}`}
            text={result.text}>
            <CodeBlock code={result.text} language="sql" />
          </ToolAnswer>

          <SaveSnippetPanel
            tool={TOOL} snippetId={snippetId}
            body={result.text}
            language="sql"
            suggestedTitle="SQL · query"
          />
        </>
      ) : null}

      <ToolSection label="Keywords it knows">
        <ToolNote>
          select · from · where · group by · order by · having · limit · offset · insert into · values ·
          update · set · delete from · returning · with · union · join (left, right, inner, outer, full,
          cross) · on · using · and · or · not · in · like · between · exists · case/when/then/else/end
        </ToolNote>
      </ToolSection>
    </>
  );
}
