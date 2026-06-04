import contentTypeService from "./content-type";
import duplicateService from "./duplicate";

const services: Record<string, unknown> = {
  "content-type": contentTypeService,
  duplicate: duplicateService,
};

export default services;
