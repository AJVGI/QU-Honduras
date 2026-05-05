#!/usr/bin/env node
/**
 * Regenerate 4/27–5/3 QA reports with proper structured DOCX content
 * and upload to Supabase storage.
 */

const path = require('path');
const ROOT = path.join(__dirname, '..');
const { createClient } = require(path.join(ROOT, 'node_modules/@supabase/supabase-js/dist/index.cjs'));
const { Document, Packer, Paragraph, TextRun } = require(path.join(ROOT, 'node_modules/docx/dist/index.cjs'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function safe(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
function heading(text, size = 32) {
  return new Paragraph({
    children: [new TextRun({ text: safe(text), bold: true, size })],
    spacing: { before: 300, after: 120 },
  });
}
function kv(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: safe(label) + ': ', bold: true }),
      new TextRun({ text: safe(String(value ?? '—')) }),
    ],
    spacing: { after: 80 },
  });
}
function blank() { return new Paragraph({ children: [] }); }

async function uploadDoc(children, storagePath) {
  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const blob = new Blob([ab], { type: DOCX_MIME });
  const { error } = await sb.storage.from('qa-reports').upload(storagePath, blob, {
    contentType: DOCX_MIME,
    upsert: true,
  });
  if (error) throw new Error('Upload failed for ' + storagePath + ': ' + error.message);
  console.log('✅ Uploaded:', storagePath, '(' + buf.byteLength + ' bytes)');
  return storagePath;
}

async function main() {
  console.log('Fetching ticket data...');
  const { data: tickets, error } = await sb
    .from('pipeline_tickets')
    .select('agent_name, category, grade, score, auto_fail, is_closed, has_recall, frt_seconds, coaching_tip, auto_fail_reason, week_start, subject')
    .gte('week_start', '2026-04-27')
    .lte('week_start', '2026-05-04')
    .limit(2000);

  if (error) throw new Error('Fetch error: ' + error.message);
  console.log('Tickets fetched:', tickets.length);

  const total = tickets.length;
  const closed = tickets.filter(t => t.is_closed).length;
  const autoFails = tickets.filter(t => t.auto_fail).length;
  const graded = tickets.filter(t => t.grade);
  const recalls = tickets.filter(t => t.has_recall).length;
  const frts = tickets.filter(t => t.frt_seconds != null).map(t => t.frt_seconds);
  const avgFrt = frts.length ? frts.reduce((a, b) => a + b, 0) / frts.length : 0;
  const agents = [...new Set(tickets.map(t => t.agent_name).filter(Boolean))].sort();
  const periodLabel = '4/27/2026 - 5/3/2026';
  const folder = '2026-04-27_2026-05-03';

  // Category counts
  const catCounts = {};
  for (const t of tickets) {
    const c = t.category || 'Unknown';
    catCounts[c] = (catCounts[c] || 0) + 1;
  }

  // Agent breakdown
  const agentData = {};
  for (const t of tickets) {
    const a = t.agent_name || 'Unknown';
    if (!agentData[a]) agentData[a] = { total: 0, closed: 0, recalls: 0, frts: [], graded: [] };
    agentData[a].total++;
    if (t.is_closed) agentData[a].closed++;
    if (t.has_recall) agentData[a].recalls++;
    if (t.frt_seconds != null) agentData[a].frts.push(t.frt_seconds);
    if (t.grade) agentData[a].graded.push(t);
  }

  const gradeMap = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const t of graded) gradeMap[t.grade] = (gradeMap[t.grade] || 0) + 1;

  // ── QA REPORT ──────────────────────────────────────────────────────────────
  const qaChildren = [
    heading('JackpotDaily QA Report — ' + periodLabel, 48),
    kv('Generated', new Date().toUTCString()),
    blank(),
    heading('Executive Summary'),
    kv('Period', periodLabel),
    kv('Total Tickets', total),
    kv('Closed', closed + ' (' + (closed / total * 100).toFixed(1) + '%)'),
    kv('Has Recall', recalls),
    kv('Avg First Response Time', (avgFrt / 60).toFixed(1) + ' min'),
    kv('Tickets Graded', graded.length),
    kv('Auto-Fails', autoFails),
    blank(),
    heading('Grade Distribution'),
    ...Object.entries(gradeMap).map(([g, cnt]) => kv('Grade ' + g, cnt + ' (' + (graded.length ? (cnt / graded.length * 100).toFixed(1) : '0') + '% of graded)')),
    blank(),
    heading('Auto-Fail Cases (' + autoFails + ' total)'),
    ...(tickets.filter(t => t.auto_fail).slice(0, 50).flatMap(t => [
      kv('Agent', t.agent_name || 'Unknown'),
      kv('Category', t.category || 'Unknown'),
      kv('Violation', t.auto_fail_reason || 'See transcript'),
      blank(),
    ])),
  ];

  // ── INQUIRY REPORT ─────────────────────────────────────────────────────────
  const inquiryChildren = [
    heading('JackpotDaily Inquiry Report — ' + periodLabel, 48),
    kv('Generated', new Date().toUTCString()),
    kv('Total Tickets', total),
    blank(),
    heading('Category Breakdown'),
    ...Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, cnt]) => kv(cat, cnt + ' tickets (' + (cnt / total * 100).toFixed(1) + '%)')),
    blank(),
    heading('Ticket Samples by Top Categories'),
  ];
  for (const [cat] of Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    const sample = tickets.filter(t => t.category === cat).slice(0, 5);
    inquiryChildren.push(heading(cat, 26));
    for (const t of sample) {
      inquiryChildren.push(
        kv('  Agent', t.agent_name || 'Unknown'),
        kv('  Grade', t.grade ? t.grade + ' (' + (t.score ?? '—') + ')' : 'Ungraded'),
        kv('  Closed', t.is_closed ? 'Yes' : 'No'),
        kv('  Recall', t.has_recall ? 'Yes' : 'No'),
        blank()
      );
    }
  }

  // ── AGENT REPORT ───────────────────────────────────────────────────────────
  const sorted = Object.entries(agentData)
    .filter(([a]) => a && a !== 'Unknown')
    .sort((a, b) => b[1].total - a[1].total);

  const agentChildren = [
    heading('JackpotDaily Agent Performance Report — ' + periodLabel, 48),
    kv('Generated', new Date().toUTCString()),
    kv('Total Agents', sorted.length),
    kv('Total Tickets', total),
    blank(),
    heading('Leaderboard'),
  ];
  for (const [agent, d] of sorted) {
    const avgA = d.frts.length ? (d.frts.reduce((a, c) => a + c, 0) / d.frts.length / 60).toFixed(1) + ' min' : 'N/A';
    agentChildren.push(kv(agent, 'Tickets: ' + d.total + ' | Closure: ' + (d.closed / d.total * 100).toFixed(0) + '% | Recalls: ' + d.recalls + ' | Avg FRT: ' + avgA));
  }
  agentChildren.push(blank(), heading('Per-Agent Detail'));
  for (const [agent, d] of sorted) {
    const avgA = d.frts.length ? (d.frts.reduce((a, c) => a + c, 0) / d.frts.length / 60).toFixed(1) + ' min' : 'N/A';
    agentChildren.push(
      heading(agent, 28),
      kv('Total Tickets', d.total),
      kv('Closed', d.closed + ' (' + (d.closed / d.total * 100).toFixed(1) + '%)'),
      kv('Recalls', d.recalls),
      kv('Avg First Response Time', avgA),
    );
    if (d.graded.length) {
      agentChildren.push(heading('Graded Samples', 22));
      for (const t of d.graded) {
        agentChildren.push(
          kv('  Grade', t.grade + ' (' + (t.score ?? '—') + ')'),
          kv('  Category', t.category),
          kv('  Auto-Fail', t.auto_fail ? 'YES — ' + (t.auto_fail_reason || 'see scorecard') : 'No'),
          kv('  Coaching Tip', t.coaching_tip || '—'),
          blank()
        );
      }
    }
    agentChildren.push(blank());
  }

  // Upload all 3
  console.log('\nUploading reports...');
  const qaPath = await uploadDoc(qaChildren, folder + '/QA_Report.docx');
  const inquiryPath = await uploadDoc(inquiryChildren, folder + '/Client_Inquiry_Report.docx');
  const agentPath = await uploadDoc(agentChildren, folder + '/Individual_Agent_Report.docx');

  // Update the most recent pipeline_run row
  const { error: updateErr } = await sb.from('pipeline_runs')
    .update({
      qa_report_path: qaPath,
      inquiry_report_path: inquiryPath,
      individual_report_path: agentPath,
    })
    .eq('id', '7353e483-6693-4c54-a935-46d73509af8c');

  if (updateErr) console.error('⚠️  DB update error:', updateErr);
  else console.log('✅ DB row updated with correct paths');

  console.log('\n✅ All done. Reports ready at:');
  console.log('  QA:', qaPath);
  console.log('  Inquiry:', inquiryPath);
  console.log('  Agent:', agentPath);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
