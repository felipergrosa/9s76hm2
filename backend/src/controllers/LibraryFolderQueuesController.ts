import { Request, Response } from "express";
import QueueRAGSource from "../models/QueueRAGSource";
import Queue from "../models/Queue";

/**
 * Lista todas as filas vinculadas a uma pasta específica
 * Elimina a necessidade de N+1 requests no frontend
 */
export const listQueuesByFolder = async (req: Request, res: Response): Promise<Response> => {
    const { folderId } = req.params;
    const { companyId } = req.user;

    try {
        // Busca todas as relações fila-pasta para esta pasta
        const ragSources = await QueueRAGSource.findAll({
            where: { folderId: Number(folderId) },
            include: [
                {
                    model: Queue,
                    as: "queue",
                    where: { companyId },
                    attributes: ["id", "name", "color"]
                }
            ],
            attributes: ["queueId", "folderId", "weight"]
        });

        // Retorna apenas as filas
        const queues = ragSources.map(source => ({
            id: (source as any).queue?.id,
            name: (source as any).queue?.name,
            color: (source as any).queue?.color,
            weight: source.weight
        })).filter(q => q.id);

        return res.status(200).json(queues);
    } catch (error) {
        console.error("Error listing queues by folder:", error);
        return res.status(500).json({ error: "Erro ao buscar filas vinculadas" });
    }
};
