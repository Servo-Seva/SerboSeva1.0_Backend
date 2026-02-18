import express from "express";
import {
  listCategoriesWithCounts,
  getServicesByCategory,
  createCategory,
  createService,
  mapServiceToCategory,
  getCategoryById,
} from "../models/category.model";

const router = express.Router();

// public: list categories with their active service counts
router.get("/categories", async (req, res) => {
  try {
    const cats = await listCategoriesWithCounts();
    res.json(cats);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "failed to list categories" });
  }
});

// public: list services for a given category id
router.get("/categories/:id/services", async (req, res) => {
  try {
    const { id } = req.params;
    const cat = await getCategoryById(id);
    if (!cat) return res.status(404).json({ error: "category not found" });
    const services = await getServicesByCategory(id);
    res.json({ category: cat, services });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "failed to list services for category" });
  }
});

// admin-ish: create category
router.post("/categories", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const cat = await createCategory(name, description);
    res.status(201).json(cat);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "failed to create category" });
  }
});

// admin-ish: create service and optionally map to category
router.post("/services", async (req, res) => {
  try {
    const { name, description, price, categoryId } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const svc = await createService(name, description, price);
    if (categoryId) {
      await mapServiceToCategory(categoryId, svc.id);
    }
    res.status(201).json(svc);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "failed to create service" });
  }
});

export default router;
