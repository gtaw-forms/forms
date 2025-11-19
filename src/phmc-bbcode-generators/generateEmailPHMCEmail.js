const generateEmailPHMCEmail = (formData) => {
  const {
    decedentName = "",
    patientNotes = "",
    synopsis = "",
    phmcEmployee = "",
    decedentOOC = "",
    patientCareer = "",
    scenePhotos = ""
  } = formData;

  const photos = scenePhotos
    .split(",")
    .map(url => url.trim())
    .filter(url => url);

  // Simple templating (no Handlebars needed for MVP)
  let bbcode = template
    .replace(/{{decedentName}}/g, decedentName)
    .replace(/{{patientNotes}}/g, patientNotes)
    .replace(/{{synopsis}}/g, synopsis)
    .replace(/{{phmcEmployee}}/g, phmcEmployee)
    .replace(/{{decedentOOC}}/g, decedentOOC)
    .replace(/{{patientCareer}}/g, patientCareer);

  if (photos.length > 0) {
    const photoTags = photos.map(url => `[img]${url}[/img]`).join("\n");
    bbcode = bbcode.replace("{{#if scenePhotos}}...{{/each}}", photoTags);
  } else {
    bbcode = bbcode.replace(/{{#if scenePhotos}}[\s\S]*?{{\/each}}/g, "");
  }

  return bbcode;
};
export default generateEmailPHMCEmail;