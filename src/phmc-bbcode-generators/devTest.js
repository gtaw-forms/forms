export const generateDevTest = (formData) => {
    let bbcode = '[h1]Developer Testing Form[/h1]\n';
    bbcode += '[b]This form is for developer testing purposes only.[/b]\n\n';

    for (const [key, value] of Object.entries(formData)) {
        bbcode += `[b]${key}:[/b] ${value}\n`;
    }

    return bbcode;
};