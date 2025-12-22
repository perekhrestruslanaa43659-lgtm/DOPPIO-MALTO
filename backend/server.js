require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { PrismaClient } = require('@prisma/client');
const { generateSchedule } = require('./scheduler');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;

console.log("Prisma Models:", Object.keys(prisma));

const fs = require('fs');
const path = require('path');

// --- AUTO-SYNC STAFF HOURS FROM CSV ---
async function syncStaffHours() {
  const csvPath = path.join(__dirname, '../WEEK_TURNI - Foglio17.csv');
  if (!fs.existsSync(csvPath)) {
    console.log("CSV sync skipped: File not found at", csvPath);
    return;
  }

  try {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    // Headers: Nome,Cognome,Email,Ruolo,OreMin,OreMax,...
    // Skip header
    let updatedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 6) continue;

      const nome = cols[0].trim();
      // const cognome = cols[1].trim(); 
      const oreMax = parseInt(cols[5].trim());

      if (nome && !isNaN(oreMax)) {
        // Update staff by Name (Case insensitive match would be better but exact is safer for now)
        // We'll use findFirst to handle slight differences or just loose matching
        const staff = await prisma.staff.findFirst({
          where: { nome: { equals: nome, mode: 'insensitive' } }
        });

        if (staff) {
          await prisma.staff.update({
            where: { id: staff.id },
            data: { oreMassime: oreMax }
          });
          updatedCount++;
        }
      }
    }
    console.log(`[SYNC] Updated hours for ${updatedCount} staff members from CSV.`);
  } catch (e) {
    console.error("[SYNC ERROR] Failed to sync staff hours:", e.message);
  }
}

// Run Sync on Startup
syncStaffHours();
ensureSeckCodouConstraints();

// One-off fix for Seck Codou
async function ensureSeckCodouConstraints() {
  try {
    const s = await prisma.staff.findFirst({
      where: {
        OR: [
          { nome: { contains: 'SECK', mode: 'insensitive' } },
          { cognome: { contains: 'SECK', mode: 'insensitive' } }
        ]
      }
    });

    if (s && (s.nome.toUpperCase().includes('CODOU') || (s.cognome && s.cognome.toUpperCase().includes('CODOU')))) {
      // Found him. Update postazioni.
      await prisma.staff.update({
        where: { id: s.id },
        data: { postazioni: 'BAR SU' } // SQLite String
      });
      console.log(`[CONSTRAINT] Updated Seck Codou postazioni to ['BAR SU']`);
    }
  } catch (e) {
    console.error("[CONSTRAINT ERROR]", e.message);
  }
}

app.use(cors());
app.use(bodyParser.json());

// --- STAFF ---
app.get('/api/staff', async (req, res) => {
  const staff = await prisma.staff.findMany({
    include: { unavailabilities: true },
    orderBy: { listIndex: 'asc' }
  });
  // Convert postazioni string -> array for frontend
  // Convert fixedShifts string -> object for frontend
  const clean = staff.map(s => ({
    ...s,
    postazioni: s.postazioni ? s.postazioni.split(',').filter(x => x) : [],
    fixedShifts: s.fixedShifts && typeof s.fixedShifts === 'string' ? JSON.parse(s.fixedShifts) : (s.fixedShifts || {})
  }));
  res.json(clean);
});

app.post('/api/staff', async (req, res) => {
  const { nome, cognome, email, ruolo, oreMinime, oreMassime, costoOra, postazioni } = req.body;
  try {
    const newStaff = await prisma.staff.create({
      data: {
        nome,
        cognome,
        email,
        ruolo,
        oreMinime: Number(oreMinime),
        oreMassime: Number(oreMassime),
        costoOra: Number(costoOra),
        postazioni: Array.isArray(postazioni) ? postazioni.join(',') : postazioni
      }
    });
    res.json(newStaff);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/staff/bulk', async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Expected array" });
  try {
    const result = await prisma.staff.createMany({
      data: items.map(i => ({
        nome: i.nome,
        cognome: i.cognome || '',
        email: i.email || null,
        ruolo: i.ruolo,
        oreMinime: Number(i.oreMinime) || 0,
        oreMassime: Number(i.oreMassime) || 40,
        costoOra: Number(i.costoOra) || 0,
        postazioni: Array.isArray(i.postazioni) ? i.postazioni.join(',') : (i.postazioni || "") // SQLite String
      })),
      skipDuplicates: true
    });
    res.json({ count: result.count });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/staff/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  console.log(`PUT /api/staff/${id}`, body); // DEBUG LOG

  // Build dynamic data object
  const data = {};
  if (body.nome !== undefined) data.nome = body.nome;
  if (body.cognome !== undefined) data.cognome = body.cognome;
  if (body.email !== undefined) data.email = body.email;
  if (body.ruolo !== undefined) data.ruolo = body.ruolo;
  if (body.oreMinime !== undefined) data.oreMinime = Number(body.oreMinime);
  if (body.oreMassime !== undefined) data.oreMassime = Number(body.oreMassime);
  if (body.costoOra !== undefined) data.costoOra = Number(body.costoOra);
  if (body.postazioni !== undefined) data.postazioni = Array.isArray(body.postazioni) ? body.postazioni.join(',') : body.postazioni;

  // JSON Stringify for SQLite
  if (body.fixedShifts !== undefined) {
    data.fixedShifts = typeof body.fixedShifts === 'string' ? body.fixedShifts : JSON.stringify(body.fixedShifts);
  }

  // Handle moving listIndex if provided
  if (body.listIndex !== undefined) {
    data.listIndex = Number(body.listIndex);
  }

  try {
    const updated = await prisma.staff.update({
      where: { id: Number(id) },
      data
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    await prisma.staff.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// --- SHIFT TEMPLATESOr "TURNI" ---
app.get('/api/shift-templates', async (req, res) => {
  const templates = await prisma.shiftTemplate.findMany();
  res.json(templates);
});

app.post('/api/shift-templates', async (req, res) => {
  const { nome, oraInizio, oraFine, ruoloRichiesto } = req.body;
  const t = await prisma.shiftTemplate.create({
    data: { nome, oraInizio, oraFine, ruoloRichiesto }
  });
  res.json(t);
});

// --- UNAVAILABILITY ---
app.get('/api/unavailability', async (req, res) => {
  const list = await prisma.unavailability.findMany({ include: { staff: true } });
  res.json(list);
});

app.post('/api/unavailability', async (req, res) => {
  const { staffId, data, tipo } = req.body;
  const u = await prisma.unavailability.create({
    data: { staffId: Number(staffId), data, tipo }
  });
  res.json(u);
});

// --- GENERATOR ---
app.post('/api/assignments/clear', async (req, res) => {
  const { startDate, endDate } = req.body;
  try {
    const deleted = await prisma.assignment.deleteMany({
      where: {
        data: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    res.json({ success: true, count: deleted.count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-schedule', async (req, res) => {
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) return res.status(400).json({ error: "Dates required" });

  try {
    // 1. Fetch Context
    const rawStaff = await prisma.staff.findMany({
      include: { unavailabilities: true }
    });

    // Parse SQLite Fields
    const allStaff = rawStaff.map(s => ({
      ...s,
      fixedShifts: s.fixedShifts && typeof s.fixedShifts === 'string' ? JSON.parse(s.fixedShifts) : (s.fixedShifts || {}),
      postazioni: s.postazioni ? s.postazioni.split(',').filter(x => x) : []
    }));

    const coverageRows = await prisma.coverageRow.findMany(); // Fetch all rules

    // Parse coverage slots/extra too if they are strings (Should act similarly to API)
    const parsedCoverage = coverageRows.map(r => ({
      ...r,
      slots: typeof r.slots === 'string' ? JSON.parse(r.slots) : r.slots,
      extra: typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra
    }));

    // 2. Run Algorithm
    const start = new Date(startDate);
    const end = new Date(endDate);

    const { assignments, logs, unassigned } = generateSchedule(start, end, allStaff, parsedCoverage);

    // 2.5 Clear Existing Assignments for the Range
    // USE RAW STRINGS to ensure exact match with UI range
    await prisma.assignment.deleteMany({
      where: {
        data: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    console.log("CLEARED EXISTING ASSIGNMENTS FOR:", startDate, "to", endDate);

    // 3. Save to DB
    const results = [];
    if (!assignments || !Array.isArray(assignments)) {
      throw new Error("Assignments is not an array!");
    }

    for (const p of assignments) {
      try {
        const created = await prisma.assignment.create({
          data: {
            data: p.date,
            staffId: p.staffId,
            shiftTemplateId: p.shiftTemplateId, // can be null
            customStart: p.customStart,
            customEnd: p.customEnd,
            postazione: p.postazione,
            stato: p.status || 'BOZZA'
          }
        });
        results.push(created);
      } catch (e) {
        console.log("Duplicate skipped or error:", e.message);
      }
    }

    res.json({ generated: results.length, logs, assignments: results, unassigned });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- EXPORT TO WEEK3 CSV ---
app.post('/api/export-week3', async (req, res) => {
  const { startDate, endDate } = req.body;
  const csvPath = path.join(__dirname, '../WEEK_TURNI - WEEK3.csv');

  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: 'File CSV non trovato sul server.' });
  }

  try {
    // 1. Get Assignments
    const assignments = await prisma.assignment.findMany({
      where: {
        data: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { staff: true, shiftTemplate: true }
    });

    // Group by Staff Name -> Date -> Shifts
    const map = {};
    assignments.forEach(a => {
      const nameKey = a.staff.nome.toUpperCase().trim();
      if (!map[nameKey]) map[nameKey] = {};
      if (!map[nameKey][a.data]) map[nameKey][a.data] = [];

      const sT = a.customStart || (a.shiftTemplate ? a.shiftTemplate.oraInizio : '');
      const eT = a.customEnd || (a.shiftTemplate ? a.shiftTemplate.oraFine : '');
      const station = a.postazione || '';
      map[nameKey][a.data].push({ start: sT, end: eT, station });
    });

    // 2. Read CSV
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split(/\r?\n/);

    // 3. Update Lines
    // Day Columns Start Indices (approx):
    // Lun: 2, Mar: 7, Mer: 12, Gio: 17, Ven: 22, Sab: 27, Dom: 32
    const dayIndices = [2, 7, 12, 17, 22, 27, 32];

    const newLines = lines.map((line, idx) => {
      if (idx < 4) return line; // Skip headers

      const cols = line.split(',');
      if (cols.length < 5) return line;

      const fName = cols[0].trim().toUpperCase();

      let shiftsMap = map[fName];

      if (shiftsMap) {
        for (let d = 0; d < 7; d++) {
          const currDate = new Date(startDate);
          currDate.setDate(currDate.getDate() + d);
          // Format YYYY-MM-DD
          const y = currDate.getFullYear();
          const m = String(currDate.getMonth() + 1).padStart(2, '0');
          const dd = String(currDate.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${dd}`;

          const dayShifts = shiftsMap[dateStr] || [];
          dayShifts.sort((a, b) => a.start.localeCompare(b.start)); // Sort by start time

          const baseCol = dayIndices[d];

          // Clear existing 4 slots
          cols[baseCol] = '';
          cols[baseCol + 1] = '';
          cols[baseCol + 2] = '';
          cols[baseCol + 3] = '';

          // Write Shift 1
          if (dayShifts[0]) {
            // If manual "DUOMO" logic needed, check staff type. But user asked to insert THESE shifts.
            // We will put Start Time in Col 0, End Time in Col 1 for Operators.
            // Or Station in Col 0??
            // Let's mix: If Station is short (e.g. DUOMO), distinct?
            // Safest: Time Start / Time End.
            cols[baseCol] = dayShifts[0].start;
            cols[baseCol + 1] = dayShifts[0].end;
          }
          // Write Shift 2
          if (dayShifts[1]) {
            cols[baseCol + 2] = dayShifts[1].start;
            cols[baseCol + 3] = dayShifts[1].end;
          }
        }
        return cols.join(',');
      }
      return line;
    });

    // 4. Write CSV
    fs.writeFileSync(csvPath, newLines.join('\n'), 'utf8');

    res.json({ success: true, message: 'File CSV aggiornato con successo!' });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/schedule/bulk', async (req, res) => {
  const items = req.body; // Expects array of { data, staffId, shiftTemplateId }
  if (!Array.isArray(items)) return res.status(400).json({ error: "Expected array" });

  try {
    // Strategy: For each item, we might want to upsert or just create.
    // Simplifying: We iterate and upsert based on unique constraint, 
    // OR we can perform a cleanup if the user wants to "overwrite" days.
    // For now, let's just Try Create and ignore duplicates (skipDuplicates).

    // NOTE: If the user changed the shift from 'A' to 'B' for the same day/staff, 
    // we should probably delete the old one first if we assume 1 shift per slot.
    // But since schema allows multiple, we'll just Insert.

    // Better Strategy for "Grid Save": 
    // If the frontend sends a matrix, it knows the state. 
    // Let's assume the frontend sends "The assignments for getting saved".
    // But dealing with deletions is hard in bulk.

    // Simple approach: Input is "Add these assignments".
    const result = await prisma.assignment.createMany({
      data: items.map(i => ({
        data: i.data,
        staffId: Number(i.staffId),
        shiftTemplateId: Number(i.shiftTemplateId),
        postazione: i.postazione || null,
        stato: i.stato || 'BOZZA'
      })),
      skipDuplicates: true
    });

    res.json({ count: result.count });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/schedule', async (req, res) => {
  const { start, end } = req.query;
  // Basic filter if params provided
  const where = {};
  if (start && end) {
    where.data = {
      gte: start,  // NOTE: String comparison works for ISO dates YYYY-MM-DD
      lte: end
    };
  }

  const schedule = await prisma.assignment.findMany({
    where,
    include: { staff: true, shiftTemplate: true }
  });

  // Also return templates so frontend can map IDs
  res.json(schedule);
});

app.post('/api/assignment', async (req, res) => {
  const { staffId, data, shiftTemplateId, customStart, customEnd, postazione, stato } = req.body;

  try {
    // Check duplication (Staff + Date + Template) only if template exists
    // Check duplication (Staff + Date + Template)
    // Relaxed validation: Just warn or proceed. Logic:
    // If same staff, same date, same template -> It's a duplicate.
    // If strict compliance is NOT needed, we can just proceed.
    // User requested: "save but return warning message". 
    // We will return a specific flag in response or just allow it.

    const payload = {
      staff: { connect: { id: parseInt(staffId) } },
      data: data,
      stato: stato || "BOZZA",
      // Use undefined for optional fields to avoid "null constraint" issues or cleaner data
      shiftTemplate: shiftTemplateId ? { connect: { id: parseInt(shiftTemplateId) } } : undefined,
      customStart: customStart || undefined,
      customEnd: customEnd || undefined,
      postazione: postazione || undefined,
    };

    const assignment = await prisma.assignment.create({ data: payload });

    // Check if it was a duplicate after creation to add warning flag
    // (Optimization: could check before, but create is done)
    // Actually, user wants "alert". We can return { ...assignment, warning: "Doppio turno!" }
    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/assignment/:id', async (req, res) => {
  const { id } = req.params;
  const { shiftTemplateId, postazione, stato } = req.body;
  try {
    const current = await prisma.assignment.findUnique({ where: { id: Number(id) } });
    if (!current) return res.status(404).json({ error: "Non trovato" });

    // Validation only if changing shiftTemplate
    if (shiftTemplateId && Number(shiftTemplateId) !== current.shiftTemplateId) {
      const data = current.data;

      // 1. Uniqueness
      const taken = await prisma.assignment.findFirst({
        where: {
          data: data,
          shiftTemplateId: Number(shiftTemplateId),
          id: { not: Number(id) } // Exclude self
        }
      });
      if (taken) return res.status(400).json({ error: "Questo turno è già assegnato ad altri." });

      // 2. Exclusivity
      const newTemplate = await prisma.shiftTemplate.findUnique({ where: { id: Number(shiftTemplateId) } });
      const startH = parseInt(newTemplate.oraInizio.split(':')[0]);
      const isLunch = startH < 17;

      const staffAssignments = await prisma.assignment.findMany({
        where: {
          staffId: current.staffId,
          data: data,
          id: { not: Number(id) }
        },
        include: { shiftTemplate: true }
      });

      for (const a of staffAssignments) {
        const tStart = parseInt(a.shiftTemplate.oraInizio.split(':')[0]);
        const tIsLunch = tStart < 17;
        // User requested Warning instead of Block.
        // We will allow it here. Frontend can handle the warning.
        // if (isLunch !== tIsLunch) return res.status(400).json({ error: "Violazione: Pranzo/Sera esclusivi." });
      }
    }

    const updated = await prisma.assignment.update({
      where: { id: Number(id) },
      data: {
        shiftTemplateId: (shiftTemplateId === undefined) ? undefined : (shiftTemplateId ? Number(shiftTemplateId) : null),
        customStart: req.body.customStart === undefined ? undefined : (req.body.customStart || null),
        customEnd: req.body.customEnd === undefined ? undefined : (req.body.customEnd || null),
        postazione: postazione,
        stato: stato
      }
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/assignment/:id', async (req, res) => {
  try {
    await prisma.assignment.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});


// Budget API
app.get('/api/budget', async (req, res) => {
  const list = await prisma.budget.findMany();
  res.json(list);
});

app.post('/api/budget', async (req, res) => {
  // Body: { data, value, hoursLunch, hoursDinner, valueLunch, valueDinner }
  const { data, value, hoursLunch, hoursDinner, valueLunch, valueDinner } = req.body;
  try {
    const pLat = (v) => parseFloat(v) || 0;

    const upserted = await prisma.budget.upsert({
      where: { data },
      update: {
        value: value !== undefined ? pLat(value) : undefined,
        hoursLunch: hoursLunch !== undefined ? pLat(hoursLunch) : undefined,
        hoursDinner: hoursDinner !== undefined ? pLat(hoursDinner) : undefined,
        valueLunch: valueLunch !== undefined ? pLat(valueLunch) : undefined,
        valueDinner: valueDinner !== undefined ? pLat(valueDinner) : undefined
      },
      create: {
        data,
        value: pLat(value),
        hoursLunch: pLat(hoursLunch),
        hoursDinner: pLat(hoursDinner),
        valueLunch: pLat(valueLunch),
        valueDinner: pLat(valueDinner)
      }
    });
    res.json(upserted);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});



// Coverage API
app.get('/api/coverage', async (req, res) => {
  try {
    const list = await prisma.coverageRow.findMany({ orderBy: { id: 'asc' } });
    // SQLite: Parse JSON strings back to objects
    const parsed = list.map(r => ({
      ...r,
      slots: typeof r.slots === 'string' ? JSON.parse(r.slots) : r.slots,
      extra: typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra
    }));
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/coverage', async (req, res) => {
  // Body: { rows: [...] }
  const { rows } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: "Rows must be array" });

  try {
    await prisma.coverageRow.deleteMany({});

    const created = await prisma.coverageRow.createMany({
      data: rows.map(r => ({
        weekStart: r.weekStart || "2025-10-13",
        station: r.station,
        frequency: r.frequency,
        slots: JSON.stringify(r.slots), // Stringify for SQLite
        extra: JSON.stringify(r.extra)  // Stringify for SQLite
      }))
    });
    res.json({ count: created.count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});


// --- AI AGENT NLP (CLAUDE) ---
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post('/api/agent/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ response: "Messaggio vuoto." });

  try {
    // 1. Context / System Prompt
    const systemPrompt = `Sei un esperto assistente per la pianificazione dei turni. 
    Hai accesso a strumenti per modificare i turni fissi dello staff.
    
    REGOLE:
    - Se l'utente chiede di impostare turni, usa SEMPRE lo strumento 'set_fixed_shifts'.
    - L'orario di PRANZO finisce prima delle 17:00 (es. 10:30-15:00).
    - L'orario di SERA inizia dalle 17:00 in poi (es. 18:00-24:00, o 18-02).
    - Se l'utente dice "26" intende le 02:00 di notte.
    - Se l'orario include mezze ore, usa il formato HH:MM (es. 10:30).
    - Cerca di essere preciso sui nomi.
    
    Il tuo obiettivo è aiutare l'utente a configurare i turni fissi nel database.`;

    // 2. Define Tools
    const tools = [
      {
        name: "set_fixed_shifts",
        description: "Imposta turni fissi per un membro dello staff in giorni specifici.",
        input_schema: {
          type: "object",
          properties: {
            staffName: { type: "string", description: "Nome o Cognome del dipendente (es. 'Mario', 'Rossi', 'Seck')" },
            days: {
              type: "array",
              items: { type: "string", enum: ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] },
              description: "Lista dei giorni (Lun, Mar, ...)"
            },
            startTime: { type: "string", description: "Orario inizio (HH:MM)" },
            endTime: { type: "string", description: "Orario fine (HH:MM)" }
          },
          required: ["staffName", "days", "startTime", "endTime"]
        }
      }
    ];

    // 3. First Call to Claude
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools,
      messages: [{ role: "user", content: message }]
    });

    let finalResponseText = "";

    // 4. Handle Tool Calls
    const toolUse = response.content.find(c => c.type === 'tool_use');

    if (toolUse) {
      const toolName = toolUse.name;
      const toolInput = toolUse.input;
      console.log(`[CLAUDE ACTION] ${toolName}`, toolInput);

      let toolResult = "";

      if (toolName === 'set_fixed_shifts') {
        // EXECUTE UPDATE
        const { staffName, days, startTime, endTime } = toolInput;

        // Find Staff
        const allStaff = await prisma.staff.findMany(); // Cache could be better
        let targetStaff = allStaff.find(s =>
          s.nome.toLowerCase().includes(staffName.toLowerCase()) ||
          (s.cognome && s.cognome.toLowerCase().includes(staffName.toLowerCase()))
        );

        if (!targetStaff) {
          toolResult = `Errore: Nessun dipendente trovato con nome '${staffName}'. Chiedi all'utente di specificare meglio.`;
        } else {
          // Update DB
          // Determine suffix P or S
          const startH = parseInt(startTime.split(':')[0]);
          const suffix = startH < 17 ? 'P' : 'S';

          const currentFixed = targetStaff.fixedShifts || {};
          days.forEach(d => {
            const key = `${d}_${suffix}`;
            currentFixed[key] = `${startTime}-${endTime}`;
          });

          await prisma.staff.update({
            where: { id: targetStaff.id },
            data: { fixedShifts: currentFixed }
          });

          toolResult = `Successo: Impostati turni per ${targetStaff.nome} ${targetStaff.cognome} nei giorni ${days.join(', ')} dalle ${startTime} alle ${endTime}.`;
        }
      }

      // 5. Send Tool Result back to Claude
      const followUp = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        tools: tools,
        messages: [
          { role: "user", content: message },
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: toolResult
              }
            ]
          }
        ]
      });

      const finalTextBlock = followUp.content.find(c => c.type === 'text');
      finalResponseText = finalTextBlock ? finalTextBlock.text : "Fatto.";

    } else {
      // No tool used, just chat
      const textBlock = response.content.find(c => c.type === 'text');
      finalResponseText = textBlock ? textBlock.text : "Non ho capito.";
    }

    res.json({ response: finalResponseText });

  } catch (e) {
    console.error("Claude API Error:", e);
    // Fallback?
    res.json({ response: "Errore API Claude: " + e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
