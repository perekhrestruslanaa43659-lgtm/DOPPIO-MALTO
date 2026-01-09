// Clear Assignments
app.post('/api/assignments/clear', async (req, res) => {
    const { startDate, endDate } = req.body;
    try {
        const result = await prisma.assignment.deleteMany({
            where: {
                data: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });
        res.json({ count: result.count });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});
