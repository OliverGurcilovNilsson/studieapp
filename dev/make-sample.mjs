// Builds dev/sample-course.json: a MADE-UP course for development. No real course material.
// Usage: node dev/make-sample.mjs dev/sample-course.json
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y)
      const o = y * (width * 3 + 1) + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// A bar chart: exposed (3 %) vs unexposed (1 %), on white with an ink baseline.
const W = 240
const H = 150
const chart = png(W, H, (x, y) => {
  if (y >= 130 && y < 134 && x >= 20 && x < 220) return [17, 17, 20]
  if (x >= 50 && x < 100 && y >= 40 && y < 130) return [244, 185, 179]
  if (x >= 140 && x < 190 && y >= 100 && y < 130) return [169, 173, 240]
  return [255, 255, 255]
})

function pdf(lines) {
  const text = lines
    .map((l, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 60 ${760 - i * 26} Td (${l}) Tj ET`)
    .join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

const article = pdf([
  'Kaffe och huvudvark - en pahittad kohortstudie',
  'Exempelsson A, Pahittad B. Tidskrift for exempel 2024;1:1-5.',
  'Detta ar en PAHITTAD artikel for att testa appen.',
  'Metod: 2 000 kontorsarbetare foljdes i ett ar.',
  'Exponering: mer an 4 koppar kaffe per dag (sjalvrapporterat).',
  'Utfall: minst en dag med huvudvark per vecka.',
  'Bortfall: 18 % i den exponerade gruppen, 6 % i den oexponerade.',
  'Resultat: RR 1,4 (95 % KI 1,1-1,8).',
])

const official = (text, sourceId, extra = {}) => ({ provenance: 'official', text, sourceId, ...extra })
const student = (text, awarded, max, sourceId, extra = {}) => ({
  provenance: 'student',
  text,
  ...(awarded === undefined ? {} : { awarded, max }),
  sourceId,
  ...extra,
})
const q = (o) => ({ origin: 'exam', status: 'approved', objectiveIds: [], answers: [], ...o })

const EA = '2025-01-17'
const EB = '2025-06-05'

const bundle = {
  format: 'studieapp-course',
  version: 1,
  course: {
    id: 'exempel',
    code: 'EX0001',
    name: 'Exempelkurs i epidemiologi',
    lang: 'sv',
    examInfo: {
      maxPoints: 50,
      passPoints: 30,
      distinctionPoints: 40,
      rules: ['Påhittad regel: felaktig avrundning ger avdrag.', 'Påhittad regel: felaktiga påståenden kan ge avdrag.'],
    },
  },
  sources: [
    { id: 'src-exam-a', file: 'exempeltenta-a.pdf', kind: 'official_exam', examId: EA },
    { id: 'src-guide-a', file: 'exempel-bedomning-a.pdf', kind: 'grading_guide', examId: EA },
    { id: 'src-student-a', file: 'exempel-studentkopia-a.pdf', kind: 'student_copy', examId: EA },
    { id: 'src-exam-b', file: 'exempeltenta-b.pdf', kind: 'official_exam', examId: EB },
    { id: 'src-student-b', file: 'exempel-studentkopia-b.pdf', kind: 'student_copy', examId: EB },
    { id: 'src-quiz', file: 'exempel-quiz.pdf', kind: 'course_quiz' },
    { id: 'src-notes', file: 'exempel-anteckningar.pdf', kind: 'own_notes' },
    { id: 'src-template', file: 'exempel-granskningsmall.pdf', kind: 'seminar_questions' },
    { id: 'src-article', file: 'exempel-artikel.pdf', kind: 'article' },
    { id: 'src-lec-1', file: 'exempel-forelasning-1.pdf', kind: 'lecture' },
    { id: 'src-lec-2', file: 'exempel-forelasning-2.pdf', kind: 'lecture' },
  ],
  lectures: [
    { id: 'lec-1', title: 'Grunder i epidemiologi (exempel)', sourceId: 'src-lec-1', topic: 'intro-studiedesigner' },
    { id: 'lec-2', title: 'Hälsoekonomi light (exempel)', sourceId: 'src-lec-2', topic: 'halsoekonomi-intro' },
  ],
  objectives: [
    { id: 'obj-design', lectureId: 'lec-1', topic: 'intro-studiedesigner', text: 'Känna igen vanliga studiedesigner.' },
    { id: 'obj-matt', lectureId: 'lec-1', topic: 'forekomstmatt', text: 'Räkna ut incidens och prevalens.' },
    { id: 'obj-effekt', lectureId: 'lec-1', topic: 'effektmatt', text: 'Räkna ut och tolka RR, OR och NNT/NNH.' },
    { id: 'obj-bias', lectureId: 'lec-1', topic: 'bias-confounding', text: 'Förklara confounding och selektionsbias.' },
    { id: 'obj-valid', lectureId: 'lec-1', topic: 'validitetsmatt', text: 'Förklara sensitivitet och specificitet.' },
    { id: 'obj-ddd', lectureId: 'lec-1', topic: 'lakemedelsanvandning-ddd', text: 'Räkna DDD per 1000 invånare och dag.' },
    { id: 'obj-ekonomi', lectureId: 'lec-2', topic: 'halsoekonomi-intro', text: 'Räkna och tolka ICER.' },
    { id: 'obj-etik', lectureId: 'lec-2', topic: 'forskningsetik', text: 'Beskriva etikprövningens grunder (inga frågor än).' },
  ],
  exams: [
    { id: EA, date: EA, kind: 'ordinarie', sourceIds: ['src-exam-a', 'src-guide-a', 'src-student-a'] },
    { id: EB, date: EB, kind: 'omtenta', sourceIds: ['src-exam-b', 'src-student-b'] },
  ],
  questions: [
    // ---------- Exam A ----------
    q({
      id: `${EA}-q1`,
      examId: EA,
      number: '1',
      part: 'concepts',
      topic: 'intro-studiedesigner',
      objectiveIds: ['obj-design'],
      type: 'mcq',
      points: 1,
      prompt:
        'En forskargrupp följer 3 000 personer som använder ett påhittat läkemedel och 3 000 som inte gör det i fem år och räknar nya fall av sömnproblem. Vilken design är det?',
      options: [
        { id: 'a', text: 'Fall-kontrollstudie' },
        { id: 'b', text: 'Kohortstudie' },
        { id: 'c', text: 'Tvärsnittsstudie' },
        { id: 'd', text: 'Ekologisk studie' },
      ],
      correct: ['b'],
      answers: [official('B. Grupperna väljs utifrån exponering och följs framåt i tid.', 'src-guide-a')],
    }),
    q({
      id: `${EA}-q2`,
      examId: EA,
      number: '2',
      part: 'concepts',
      topic: 'validitetsmatt',
      objectiveIds: ['obj-valid'],
      type: 'mcq_multi',
      points: 2,
      negativeMarking: true,
      prompt: 'Vilka påståenden om ett påhittat diagnostiskt test stämmer? Välj alla som stämmer. Fel val ger avdrag.',
      options: [
        { id: 'a', text: 'Sensitivitet är andelen sjuka som testar positivt.' },
        { id: 'b', text: 'Specificitet är andelen positiva test som är sjuka.' },
        { id: 'c', text: 'Det positiva prediktiva värdet beror på hur vanlig sjukdomen är.' },
        { id: 'd', text: 'Ett test med hög sensitivitet ger många falskt negativa.' },
      ],
      correct: ['a', 'c'],
      answers: [official('A och C. B beskriver PPV, och hög sensitivitet ger få falskt negativa.', 'src-guide-a')],
    }),
    q({
      id: `${EA}-q3a`,
      examId: EA,
      number: '3a',
      part: 'concepts',
      topic: 'lakemedelsanvandning-ddd',
      objectiveIds: ['obj-ddd'],
      type: 'calculation',
      points: 2,
      context: 'I den påhittade kommunen Exempelby bor 40 000 personer. Under ett år såldes 1 000 000 DDD av ett sömnmedel.',
      prompt: 'Beräkna antal DDD per 1000 invånare och dag. Svara med en decimal.',
      numeric: {
        value: 68.4932,
        unit: 'DDD/1000 inv/dag',
        decimals: 1,
        solution: [
          'Invånardagar: 40 000 × 365 = 14 600 000',
          'DDD per invånardag: 1 000 000 ÷ 14 600 000 = 0,068493',
          'Per 1000 invånare: 0,068493 × 1000 = 68,5 DDD/1000 inv/dag',
        ],
      },
      answers: [official('68,5 DDD/1000 invånare och dag.', 'src-guide-a')],
    }),
    q({
      id: `${EA}-q3b`,
      examId: EA,
      number: '3b',
      part: 'concepts',
      topic: 'effektmatt',
      objectiveIds: ['obj-effekt'],
      type: 'calculation',
      points: 2,
      assetIds: ['fig-1'],
      context:
        'En påhittad kohort följdes i ett år. Figuren visar andelen som fick biverkningen.\n\n| Grupp | Antal | Fall |\n|---|---|---|\n| Exponerade | 1 000 | 30 |\n| Oexponerade | 1 000 | 10 |',
      prompt: 'Beräkna NNH (number needed to harm).',
      numeric: {
        value: 50,
        tolerance: 0.5,
        solution: [
          'Risk exponerade: 30 ÷ 1 000 = 0,03',
          'Risk oexponerade: 10 ÷ 1 000 = 0,01',
          'Riskdifferens: 0,03 − 0,01 = 0,02',
          'NNH = 1 ÷ 0,02 = 50',
        ],
      },
      answers: [official('NNH = 50: för varje 50 som exponeras får en extra person biverkningen.', 'src-guide-a')],
    }),
    q({
      id: `${EA}-q4`,
      examId: EA,
      number: '4',
      part: 'concepts',
      topic: 'bias-confounding',
      objectiveIds: ['obj-bias'],
      type: 'free_text',
      points: 4,
      prompt: 'Vad menas med confounding? Ge ett påhittat exempel där ett läkemedel ser farligare ut än det är.',
      keyPoints: [
        'Faktorn hänger ihop med exponeringen',
        'Faktorn påverkar utfallet oberoende av exponeringen',
        'Faktorn är inte ett mellanled',
        'Ett rimligt läkemedelsexempel',
      ],
      commonMistakes: ['Att blanda ihop confounding med selektionsbias'],
      answers: [
        official(
          'En confounder är kopplad till exponeringen, påverkar risken för utfallet på egen hand och ligger inte i orsakskedjan. Exempel: patienter som får ett nytt medel är sjukare från början, så medlet ser farligt ut fast det är grundsjukdomen som ger utfallet.',
          'src-guide-a',
        ),
        student(
          'En tredje faktor som är kopplad till både exponering och utfall men inte är ett mellanled, t.ex. att de som får medlet redan är sjukare (confounding by indication).',
          4,
          4,
          'src-student-a',
        ),
        student('När något annat påverkar resultatet, t.ex. ålder.', 2, 4, 'src-student-a', {
          graderComment: 'Kriterierna saknas och exemplet gäller inte ett läkemedel.',
        }),
      ],
    }),
    q({
      id: `${EA}-q5`,
      examId: EA,
      number: '5',
      part: 'concepts',
      topic: 'halsoekonomi-intro',
      objectiveIds: ['obj-ekonomi'],
      type: 'free_text',
      points: 3,
      prompt: 'Beskriv kort skillnaden mellan en kostnadseffektanalys och en kostnadsnyttoanalys.',
      explanation: 'Påhittad förklaring: nyttoanalysen väger in livskvalitet, oftast som QALY.',
      answers: [
        student('Effektanalysen mäter i naturliga enheter, nyttoanalysen i nyttoenheter.', 2, 3, 'src-student-a', {
          graderComment: 'Nämn QALY.',
        }),
        student('Nyttoanalysen räknar med QALY, den andra bara kostnad per effekt.', undefined, undefined, 'src-student-a'),
      ],
    }),
    q({
      id: `${EA}-q6`,
      examId: EA,
      number: '6',
      part: 'article',
      topic: 'artikelgranskning',
      objectiveIds: [],
      type: 'article_review',
      points: 3,
      articleId: 'art-1',
      templateItemId: 't1-3',
      prompt: 'Hur kan bortfallet ha påverkat resultatet i artikeln?',
      keyPoints: ['Bortfallet skiljer sig mellan grupperna', 'Kan ge selektionsbias', 'Riktningen på felet diskuteras'],
      answers: [
        official(
          'Bortfallet är större bland de exponerade (18 % mot 6 %). Om de som föll bort skiljer sig i risk för huvudvärk kan det ge selektionsbias, åt båda hållen.',
          'src-guide-a',
        ),
      ],
    }),

    // ---------- Exam B ----------
    q({
      id: `${EB}-q1`,
      examId: EB,
      number: '1',
      part: 'concepts',
      topic: 'forekomstmatt',
      objectiveIds: ['obj-matt'],
      type: 'mcq',
      points: 1,
      prompt: 'Vilket mått beskriver andelen i en befolkning som har en sjukdom vid en viss tidpunkt?',
      options: [
        { id: 'a', text: 'Incidensproportion' },
        { id: 'b', text: 'Incidensrat' },
        { id: 'c', text: 'Punktprevalens' },
        { id: 'd', text: 'Mortalitet' },
      ],
      correct: ['c'],
      answers: [official('C. Punktprevalens.', 'src-exam-b')],
    }),
    q({
      id: `${EB}-q2`,
      examId: EB,
      number: '2',
      part: 'concepts',
      topic: 'effektmatt',
      objectiveIds: ['obj-effekt'],
      type: 'mcq',
      points: 1,
      prompt: 'Vilket effektmått räknar man normalt ut i en fall-kontrollstudie?',
      options: [
        { id: 'a', text: 'Relativ risk' },
        { id: 'b', text: 'Oddskvot' },
        { id: 'c', text: 'Riskdifferens' },
        { id: 'd', text: 'Incidensrat' },
      ],
      correct: ['b'],
      answers: [official('B. Oddskvot, eftersom risken inte kan skattas direkt.', 'src-exam-b')],
    }),
    q({
      id: `${EB}-q3`,
      examId: EB,
      number: '3',
      part: 'concepts',
      topic: 'forekomstmatt',
      objectiveIds: ['obj-matt'],
      type: 'calculation',
      points: 2,
      prompt: 'I en påhittad enkät svarade 1 800 personer och 234 hade besvär just nu. Beräkna prevalensen i procent med en decimal.',
      numeric: {
        value: 13,
        unit: '%',
        decimals: 1,
        solution: ['234 ÷ 1 800 = 0,13', '0,13 × 100 = 13,0 %'],
      },
      answers: [official('13,0 %', 'src-exam-b')],
    }),
    q({
      id: `${EB}-q4`,
      examId: EB,
      number: '4',
      part: 'concepts',
      topic: 'intro-studiedesigner',
      objectiveIds: ['obj-design'],
      type: 'free_text',
      points: 3,
      prompt: 'Ge en fördel och en nackdel med en fall-kontrollstudie jämfört med en kohortstudie.',
      keyPoints: ['Fördel: bra för ovanliga utfall', 'Fördel: snabb och billig', 'Nackdel: risk för recall bias'],
      answers: [
        student(
          'Fördel: passar för ovanliga sjukdomar och går snabbt. Nackdel: exponeringen mäts i efterhand, vilket ger risk för recall bias.',
          3,
          3,
          'src-student-b',
        ),
      ],
    }),
    q({
      id: `${EB}-q5`,
      examId: EB,
      number: '5',
      part: 'concepts',
      topic: 'halsoekonomi-intro',
      objectiveIds: ['obj-ekonomi'],
      type: 'calculation',
      points: 2,
      context: 'Ett påhittat nytt läkemedel kostar 120 000 kr mer per patient än standardbehandlingen och ger 0,8 fler QALY.',
      prompt: 'Beräkna ICER. Avrunda till heltal.',
      numeric: {
        value: 150000,
        unit: 'kr/QALY',
        decimals: 0,
        solution: ['ICER = Δkostnad ÷ Δeffekt', '120 000 ÷ 0,8 = 150 000 kr per vunnen QALY'],
      },
      answers: [official('150 000 kr/QALY', 'src-exam-b')],
    }),
    q({
      id: `${EB}-q6`,
      examId: EB,
      number: '6',
      part: 'article',
      topic: 'artikelgranskning',
      objectiveIds: [],
      type: 'article_review',
      points: 2,
      articleId: 'art-1',
      templateItemId: 't1-1',
      prompt: 'Vilken studiedesign har artikeln? Motivera.',
      answers: [
        student('Kohortstudie, eftersom deltagarna delas in efter exponering och följs framåt i ett år.', 2, 2, 'src-student-b'),
      ],
    }),

    // ---------- Outside the exams ----------
    q({
      id: 'ws-1',
      origin: 'workshop',
      topic: 'bias-confounding',
      objectiveIds: ['obj-bias'],
      type: 'free_text',
      prompt: 'Workshop (påhittad): hur kan man hantera confounding i analysen?',
      answers: [
        {
          provenance: 'own_notes',
          short: 'Stratifiering eller multivariat regression, och matchning i designen.',
          text: 'Man kan stratifiera på confoundern och räkna ett viktat mått (Mantel-Haenszel), eller justera i en regressionsmodell. Redan i designen kan man matcha eller begränsa urvalet. Okända confounders hanteras bäst genom randomisering.',
          sourceId: 'src-notes',
        },
      ],
    }),
    q({
      id: 'ws-2',
      origin: 'workshop',
      topic: 'validitetsmatt',
      objectiveIds: ['obj-valid'],
      type: 'free_text',
      prompt: 'Workshop (påhittad): varför sjunker PPV när sjukdomen är ovanlig?',
      answers: [
        {
          provenance: 'own_notes',
          text: 'När få är sjuka blir de falskt positiva många jämfört med de sant positiva, så en större andel av de positiva testen är fel.',
          sourceId: 'src-notes',
        },
      ],
    }),
    q({
      id: 'fc-1',
      origin: 'quiz',
      topic: 'forekomstmatt',
      objectiveIds: ['obj-matt'],
      type: 'flashcard',
      prompt: 'Incidens',
      answers: [official('Antal nya fall under en period i en befolkning som från början var fri från sjukdomen.', 'src-quiz')],
    }),
    q({
      id: 'fc-2',
      origin: 'quiz',
      topic: 'halsoekonomi-intro',
      objectiveIds: ['obj-ekonomi'],
      type: 'flashcard',
      prompt: 'QALY',
      answers: [official('Kvalitetsjusterat levnadsår: ett år i full hälsa = 1 QALY.', 'src-quiz')],
    }),
    q({
      id: 'quiz-1',
      origin: 'quiz',
      topic: 'lakemedelsanvandning-ddd',
      objectiveIds: ['obj-ddd'],
      type: 'mcq',
      prompt: 'Vad står DDD för?',
      options: [
        { id: 'a', text: 'Defined Daily Dose' },
        { id: 'b', text: 'Daily Drug Dispensing' },
        { id: 'c', text: 'Dose Duration Data' },
      ],
      correct: ['a'],
      answers: [official('Defined Daily Dose: antagen genomsnittlig underhållsdos per dag för en vuxen.', 'src-quiz')],
    }),
  ],
  reviewTemplates: [
    {
      id: 'rt-1',
      name: 'Granskningsmall (exempel)',
      sourceId: 'src-template',
      items: [
        { id: 't1-1', number: 1, section: 'Design', text: 'Vilken studiedesign har artikeln?' },
        { id: 't1-2', number: 2, section: 'Urval', text: 'Hur valdes deltagarna ut?' },
        { id: 't1-3', number: 3, section: 'Validitet', text: 'Hur kan bortfallet ha påverkat resultatet?' },
      ],
    },
  ],
  articles: [
    {
      id: 'art-1',
      title: 'Kaffe och huvudvärk – en påhittad kohortstudie',
      citation: 'Exempelsson A, Påhittad B. Tidskrift för exempel. 2024;1:1–5.',
      design: 'Kohortstudie',
      assetId: 'article-1-pdf',
      templateId: 'rt-1',
      sourceIds: ['src-article'],
    },
  ],
  assets: [
    { id: 'fig-1', mime: 'image/png', data: chart.toString('base64'), caption: 'Andel med biverkning per grupp (påhittade data)' },
    { id: 'article-1-pdf', mime: 'application/pdf', data: article.toString('base64'), caption: 'Påhittad artikel' },
  ],
}

writeFileSync(process.argv[2], JSON.stringify(bundle, null, 2) + '\n')
console.log('questions', bundle.questions.length)
