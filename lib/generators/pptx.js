import PptxGenJS from 'pptxgenjs';

export async function generatePPTX(data) {
  const pres = new PptxGenJS();
  
  const { title, slides } = data;
  
  if (title) {
    const slide = pres.addSlide();
    slide.addText(title, { x: 0.5, y: 1, fontSize: 24, bold: true });
  }
  
  if (slides && Array.isArray(slides)) {
    slides.forEach(slideData => {
      const slide = pres.addSlide();
      if (slideData.title) {
        slide.addText(slideData.title, { x: 0.5, y: 0.3, fontSize: 18, bold: true });
      }
      if (slideData.content && Array.isArray(slideData.content)) {
        slideData.content.forEach((text, idx) => {
          slide.addText(text, { x: 0.5, y: 0.8 + (idx * 0.4), fontSize: 14 });
        });
      }
    });
  }
  
  const buffer = await pres.write('nodebuffer');
  return buffer;
}
