import assert from 'node:assert/strict'

// Check actual computed colors on the solid surfaces that carry controls,
// project names and form fields. WebGL/editorial backgrounds also receive
// a visual check in the responsive screenshots.
export async function auditContrast(page){
  const result=await page.evaluate(()=>{
    const color=value=>{
      const n=value.match(/[\d.]+/g)?.map(Number)
      return n?.length>=3?[n[0]/255,n[1]/255,n[2]/255,n[3]??1]:[0,0,0,0]
    }
    const blend=(fg,bg)=>[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3])).concat(1)
    const luminance=c=>[.2126,.7152,.0722].reduce((sum,w,i)=>{
      const v=c[i]<=.04045?c[i]/12.92:((c[i]+.055)/1.055)**2.4
      return sum+w*v
    },0)
    const ratio=(a,b)=>{
      const x=luminance(a),y=luminance(b)
      return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)
    }
    const backing=el=>{
      const layers=[]
      for(let p=el;p;p=p.parentElement){
        const c=color(getComputedStyle(p).backgroundColor)
        if(c[3])layers.push(c)
        if(c[3]===1)break
      }
      let bg=[1,1,1,1]
      for(const layer of layers.reverse())bg=blend(layer,bg)
      return bg
    }
    const checks=[],failures=[]
    const groups=[
      ['project-title','.fork-title'],['project-description','.fork-title small'],
      ['project-number','.fork-number'],['header-action','.header-home-link,.header-return,.header-menu-toggle'],
      ['quick-navigation','.header-primary a'],['breadcrumb','.header-crumb a,.crumb-current'],
      ['menu-links','.navigation-main-links strong,.navigation-link-text small,.navigation-projects>a strong,.navigation-link-number,.navigation-projects>a span:first-child'],
      ['menu-close','.navigation-close'],['project-list-instructions','.crossroads-top p'],
      ['form-label','.portfolio-contact-form label'],['form-privacy','.contact-privacy'],
      ['primary-action','.hero-projects-link,.contact-submit,.detail-primary'],['footer','.site-footer span,.site-footer a']
    ]
    for(const [label,selector]of groups){
      for(const el of document.querySelectorAll(selector)){
        if(!el.getClientRects().length||el.closest('.contact-honey,[aria-hidden="true"]'))continue
        const style=getComputedStyle(el),bg=backing(el),fg=color(style.color)
        fg[3]*=Number(style.opacity)
        const contrast=ratio(blend(fg,bg),bg)
        const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700)
        const threshold=large?3:4.5
        const check={label,text:el.textContent.trim().slice(0,55),ratio:+contrast.toFixed(2),threshold}
        checks.push(check)
        if(contrast<threshold)failures.push(check)
      }
    }
    for(const el of document.querySelectorAll('.portfolio-contact-form input:not([type=hidden]),.portfolio-contact-form textarea')){
      if(el.closest('.contact-honey'))continue
      const bg=backing(el),fg=color(getComputedStyle(el,'::placeholder').color)
      const check={label:'input-placeholder',text:el.id,ratio:+ratio(blend(fg,bg),bg).toFixed(2),threshold:4.5}
      checks.push(check);if(check.ratio<check.threshold)failures.push(check)
      const edge=color(getComputedStyle(el).borderTopColor)
      const boundary={label:'input-boundary',text:el.id,ratio:+ratio(blend(edge,bg),bg).toFixed(2),threshold:3}
      checks.push(boundary);if(boundary.ratio<boundary.threshold)failures.push(boundary)
    }
    return {checks:checks.length,minimum:Math.min(...checks.map(c=>c.ratio)),failures}
  })
  assert.deepEqual(result.failures,[],'insufficient component contrast: '+JSON.stringify(result.failures))
  return result
}
