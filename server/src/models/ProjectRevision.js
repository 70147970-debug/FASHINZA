import { CREATED_ONLY, makeSchema, mixed, model, ref } from "./_schema.js";

/** Snapshot of changed fields when a brand edits a submitted project: { field: { from, to } }. */
const schema = makeSchema(
  {
    projectId: ref("Project"),
    changedById: ref("User"),
    changes: mixed(),
  },
  { collection: "project_revision", timestamps: CREATED_ONLY },
);
schema.index({ projectId: 1, createdAt: 1 });

export const ProjectRevision = model("ProjectRevision", schema);
export default ProjectRevision;
