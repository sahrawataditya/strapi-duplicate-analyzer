import contentTypeController from "./content-type";
import duplicateController from "./duplicate";

const controllers: Record<string, unknown> = {
  "content-type": contentTypeController,
  duplicate: duplicateController,
};

export default controllers;
