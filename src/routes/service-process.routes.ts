import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/admin.middleware";
import {
  getServiceProcessDetails,
  upsertServiceProcessDetails,
  getServiceProcesses,
  createServiceProcess,
  updateServiceProcess,
  deleteServiceProcess,
  getCoverPromises,
  createCoverPromise,
  updateCoverPromise,
  deleteCoverPromise,
  getServiceFAQs,
  createServiceFAQ,
  updateServiceFAQ,
  deleteServiceFAQ,
  upsertServiceProcesses,
  upsertCoverPromises,
  upsertServiceFAQs,
  upsertServiceIncludes,
  upsertServiceExcludes,
  getServiceIncludes,
  getServiceExcludes,
} from "../models/service-process.model";

const router = express.Router();

// ============== PUBLIC ROUTES ==============

/**
 * GET /api/services/:serviceId/process-details
 * Get all process details for a service (processes, promises, FAQs, includes, excludes)
 */
router.get("/services/:serviceId/process-details", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const details = await getServiceProcessDetails(serviceId);
    res.json({ success: true, data: details });
  } catch (err: any) {
    console.error("Error fetching service process details:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch service process details",
      details: err.message,
    });
  }
});

/**
 * GET /api/services/:serviceId/processes
 * Get process steps for a service
 */
router.get("/services/:serviceId/processes", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const processes = await getServiceProcesses(serviceId);
    res.json({ success: true, data: processes });
  } catch (err: any) {
    console.error("Error fetching service processes:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch service processes",
    });
  }
});

/**
 * GET /api/services/:serviceId/cover-promises
 * Get cover promises for a service
 */
router.get("/services/:serviceId/cover-promises", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const promises = await getCoverPromises(serviceId);
    res.json({ success: true, data: promises });
  } catch (err: any) {
    console.error("Error fetching cover promises:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cover promises",
    });
  }
});

/**
 * GET /api/services/:serviceId/faqs
 * Get FAQs for a service
 */
router.get("/services/:serviceId/faqs", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const faqs = await getServiceFAQs(serviceId);
    res.json({ success: true, data: faqs });
  } catch (err: any) {
    console.error("Error fetching service FAQs:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch service FAQs",
    });
  }
});

/**
 * GET /api/services/:serviceId/includes
 * Get what's included in a service
 */
router.get("/services/:serviceId/includes", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const includes = await getServiceIncludes(serviceId);
    res.json({ success: true, data: includes });
  } catch (err: any) {
    console.error("Error fetching service includes:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch service includes",
    });
  }
});

/**
 * GET /api/services/:serviceId/excludes
 * Get what's NOT included in a service
 */
router.get("/services/:serviceId/excludes", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const excludes = await getServiceExcludes(serviceId);
    res.json({ success: true, data: excludes });
  } catch (err: any) {
    console.error("Error fetching service excludes:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch service excludes",
    });
  }
});

// ============== ADMIN ROUTES (Protected) ==============

/**
 * PUT /api/admin/services/:serviceId/process-details
 * Bulk update all process details for a service
 */
router.put(
  "/admin/services/:serviceId/process-details",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { processes, coverPromises, faqs, includes, excludes } = req.body;

      const details = await upsertServiceProcessDetails(serviceId, {
        processes,
        coverPromises,
        faqs,
        includes,
        excludes,
      });

      res.json({ success: true, data: details });
    } catch (err: any) {
      console.error("Error updating service process details:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update service process details",
        details: err.message,
      });
    }
  }
);

/**
 * PUT /api/admin/services/:serviceId/processes
 * Bulk update process steps for a service
 */
router.put(
  "/admin/services/:serviceId/processes",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { processes } = req.body;

      if (!Array.isArray(processes)) {
        return res.status(400).json({
          success: false,
          error: "processes must be an array",
        });
      }

      const result = await upsertServiceProcesses(serviceId, processes);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Error updating service processes:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update service processes",
      });
    }
  }
);

/**
 * POST /api/admin/services/:serviceId/processes
 * Add a single process step
 */
router.post(
  "/admin/services/:serviceId/processes",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const {
        step_number,
        title,
        description,
        icon,
        estimated_minutes,
        is_required,
      } = req.body;

      if (!step_number || !title) {
        return res.status(400).json({
          success: false,
          error: "step_number and title are required",
        });
      }

      const process = await createServiceProcess({
        service_id: serviceId,
        step_number,
        title,
        description,
        icon,
        estimated_minutes,
        is_required,
      });

      res.json({ success: true, data: process });
    } catch (err: any) {
      console.error("Error creating service process:", err);
      res.status(500).json({
        success: false,
        error: "Failed to create service process",
      });
    }
  }
);

/**
 * PATCH /api/admin/processes/:processId
 * Update a single process step
 */
router.patch("/admin/processes/:processId", requireAdmin, async (req, res) => {
  try {
    const { processId } = req.params;
    const data = req.body;

    const process = await updateServiceProcess(processId, data);
    if (!process) {
      return res.status(404).json({
        success: false,
        error: "Process step not found",
      });
    }

    res.json({ success: true, data: process });
  } catch (err: any) {
    console.error("Error updating service process:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update service process",
    });
  }
});

/**
 * DELETE /api/admin/processes/:processId
 * Delete a single process step
 */
router.delete("/admin/processes/:processId", requireAdmin, async (req, res) => {
  try {
    const { processId } = req.params;
    const deleted = await deleteServiceProcess(processId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Process step not found",
      });
    }

    res.json({ success: true, message: "Process step deleted" });
  } catch (err: any) {
    console.error("Error deleting service process:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete service process",
    });
  }
});

/**
 * PUT /api/admin/services/:serviceId/cover-promises
 * Bulk update cover promises for a service
 */
router.put(
  "/admin/services/:serviceId/cover-promises",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { promises } = req.body;

      if (!Array.isArray(promises)) {
        return res.status(400).json({
          success: false,
          error: "promises must be an array",
        });
      }

      const result = await upsertCoverPromises(serviceId, promises);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Error updating cover promises:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update cover promises",
      });
    }
  }
);

/**
 * POST /api/admin/services/:serviceId/cover-promises
 * Add a single cover promise
 */
router.post(
  "/admin/services/:serviceId/cover-promises",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { title, description, icon, sort_order } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          error: "title is required",
        });
      }

      const promise = await createCoverPromise({
        service_id: serviceId,
        title,
        description,
        icon,
        sort_order,
      });

      res.json({ success: true, data: promise });
    } catch (err: any) {
      console.error("Error creating cover promise:", err);
      res.status(500).json({
        success: false,
        error: "Failed to create cover promise",
      });
    }
  }
);

/**
 * PATCH /api/admin/cover-promises/:promiseId
 * Update a single cover promise
 */
router.patch(
  "/admin/cover-promises/:promiseId",
  requireAdmin,
  async (req, res) => {
    try {
      const { promiseId } = req.params;
      const data = req.body;

      const promise = await updateCoverPromise(promiseId, data);
      if (!promise) {
        return res.status(404).json({
          success: false,
          error: "Cover promise not found",
        });
      }

      res.json({ success: true, data: promise });
    } catch (err: any) {
      console.error("Error updating cover promise:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update cover promise",
      });
    }
  }
);

/**
 * DELETE /api/admin/cover-promises/:promiseId
 * Delete a single cover promise
 */
router.delete(
  "/admin/cover-promises/:promiseId",
  requireAdmin,
  async (req, res) => {
    try {
      const { promiseId } = req.params;
      const deleted = await deleteCoverPromise(promiseId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Cover promise not found",
        });
      }

      res.json({ success: true, message: "Cover promise deleted" });
    } catch (err: any) {
      console.error("Error deleting cover promise:", err);
      res.status(500).json({
        success: false,
        error: "Failed to delete cover promise",
      });
    }
  }
);

/**
 * PUT /api/admin/services/:serviceId/faqs
 * Bulk update FAQs for a service
 */
router.put(
  "/admin/services/:serviceId/faqs",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { faqs } = req.body;

      if (!Array.isArray(faqs)) {
        return res.status(400).json({
          success: false,
          error: "faqs must be an array",
        });
      }

      const result = await upsertServiceFAQs(serviceId, faqs);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Error updating FAQs:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update FAQs",
      });
    }
  }
);

/**
 * POST /api/admin/services/:serviceId/faqs
 * Add a single FAQ
 */
router.post(
  "/admin/services/:serviceId/faqs",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { question, answer, sort_order } = req.body;

      if (!question || !answer) {
        return res.status(400).json({
          success: false,
          error: "question and answer are required",
        });
      }

      const faq = await createServiceFAQ({
        service_id: serviceId,
        question,
        answer,
        sort_order,
      });

      res.json({ success: true, data: faq });
    } catch (err: any) {
      console.error("Error creating FAQ:", err);
      res.status(500).json({
        success: false,
        error: "Failed to create FAQ",
      });
    }
  }
);

/**
 * PATCH /api/admin/faqs/:faqId
 * Update a single FAQ
 */
router.patch("/admin/faqs/:faqId", requireAdmin, async (req, res) => {
  try {
    const { faqId } = req.params;
    const data = req.body;

    const faq = await updateServiceFAQ(faqId, data);
    if (!faq) {
      return res.status(404).json({
        success: false,
        error: "FAQ not found",
      });
    }

    res.json({ success: true, data: faq });
  } catch (err: any) {
    console.error("Error updating FAQ:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update FAQ",
    });
  }
});

/**
 * DELETE /api/admin/faqs/:faqId
 * Delete a single FAQ
 */
router.delete("/admin/faqs/:faqId", requireAdmin, async (req, res) => {
  try {
    const { faqId } = req.params;
    const deleted = await deleteServiceFAQ(faqId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "FAQ not found",
      });
    }

    res.json({ success: true, message: "FAQ deleted" });
  } catch (err: any) {
    console.error("Error deleting FAQ:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete FAQ",
    });
  }
});

/**
 * PUT /api/admin/services/:serviceId/includes
 * Bulk update includes for a service
 */
router.put(
  "/admin/services/:serviceId/includes",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { includes } = req.body;

      if (!Array.isArray(includes)) {
        return res.status(400).json({
          success: false,
          error: "includes must be an array",
        });
      }

      const result = await upsertServiceIncludes(serviceId, includes);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Error updating includes:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update includes",
      });
    }
  }
);

/**
 * PUT /api/admin/services/:serviceId/excludes
 * Bulk update excludes for a service
 */
router.put(
  "/admin/services/:serviceId/excludes",
  requireAdmin,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { excludes } = req.body;

      if (!Array.isArray(excludes)) {
        return res.status(400).json({
          success: false,
          error: "excludes must be an array",
        });
      }

      const result = await upsertServiceExcludes(serviceId, excludes);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Error updating excludes:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update excludes",
      });
    }
  }
);

export default router;
