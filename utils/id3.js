// Educational ID3 decision-tree implementation for multiple student targets.
function entropy(rows) {
  if (!rows.length) return 0;
  const counts = {};
  rows.forEach(r => counts[r.label] = (counts[r.label] || 0) + 1);
  return Object.values(counts).reduce((sum, n) => { const p=n/rows.length; return sum-p*Math.log2(p); }, 0);
}
function informationGain(rows, attribute) {
  if (!rows.length) return 0;
  const groups = {};
  rows.forEach(r => (groups[r.features[attribute]] ||= []).push(r));
  const weighted = Object.values(groups).reduce((sum,g)=>sum+(g.length/rows.length)*entropy(g),0);
  return entropy(rows)-weighted;
}
function majority(rows) {
  const counts={}; rows.forEach(r=>counts[r.label]=(counts[r.label]||0)+1);
  return Object.keys(counts).sort((a,b)=>counts[b]-counts[a] || a.localeCompare(b))[0] || 'Unknown';
}
function buildTree(rows, attributes) {
  if (!rows.length) return null;
  const labels=[...new Set(rows.map(r=>r.label))];
  if (labels.length===1) return {type:'leaf',category:labels[0],samples:rows.length};
  if (!attributes.length) return {type:'leaf',category:majority(rows),samples:rows.length};
  const gains=attributes.map(attribute=>({attribute,gain:informationGain(rows,attribute)})).sort((a,b)=>b.gain-a.gain);
  const best=gains[0];
  if (!best || best.gain <= 1e-12) return {type:'leaf',category:majority(rows),samples:rows.length};
  const node={type:'node',attribute:best.attribute,gain:best.gain,branches:{}};
  [...new Set(rows.map(r=>r.features[best.attribute]))].sort().forEach(value=>{
    node.branches[value]=buildTree(rows.filter(r=>r.features[best.attribute]===value),attributes.filter(a=>a!==best.attribute));
  });
  return node;
}
function predict(tree, features) {
  let node=tree;
  while(node && node.type==='node') {
    const next=node.branches[features[node.attribute]];
    if (!next) return majorityLeaf(node);
    node=next;
  }
  return node?.category || 'Unknown';
}
function majorityLeaf(node) {
  const labels=[]; const walk=n=>{if(!n)return;if(n.type==='leaf')labels.push(n.category);else Object.values(n.branches||{}).forEach(walk);}; walk(node);
  const counts={}; labels.forEach(l=>counts[l]=(counts[l]||0)+1);
  return Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0] || 'Unknown';
}
const TARGETS = {
  category: {label:'Performance Category', classes:['At Risk','Needs Improvement','Performing Well'], features:['attendanceLevel','marksLevel'], makeLabel:s=>s.attendance<75 || average(s)<40?'At Risk':average(s)>=75?'Performing Well':'Needs Improvement'},
  attendance: {label:'Attendance Status', classes:['Low Attendance','Moderate Attendance','High Attendance'], features:['marksLevel','assignmentLevel','internalLevel'], makeLabel:s=>s.attendance<60?'Low Attendance':s.attendance<75?'Moderate Attendance':'High Attendance'},
  internal: {label:'Internal Exam Result', classes:['Fail','Pass','Distinction'], features:['attendanceLevel','externalLevel','assignmentLevel'], makeLabel:s=>s.internalMarks<40?'Fail':s.internalMarks>=75?'Distinction':'Pass'},
  external: {label:'External Exam Result', classes:['Fail','Pass','Distinction'], features:['attendanceLevel','internalLevel','assignmentLevel'], makeLabel:s=>s.externalMarks==null?'Not Available':s.externalMarks<40?'Fail':s.externalMarks>=75?'Distinction':'Pass'},
  assignment: {label:'Assignment Status', classes:['Incomplete','Satisfactory','Excellent'], features:['attendanceLevel','internalLevel','externalLevel'], makeLabel:s=>s.assignmentMarks<40?'Incomplete':s.assignmentMarks>=75?'Excellent':'Satisfactory'}
};
function average(s) { const vals=[Number(s.internalMarks)||0,Number(s.assignmentMarks)||0]; if(s.externalMarks!==undefined && s.externalMarks!==null && s.externalMarks!=='') vals.push(Number(s.externalMarks)||0); return vals.reduce((a,b)=>a+b,0)/vals.length; }
function level(value) { return value>=75?'High':value>=40?'Medium':'Low'; }
function featuresFor(s) { return {attendanceLevel:Number(s.attendance)>=75?'Good':Number(s.attendance)>=60?'Moderate':'Low', marksLevel:level(average(s)), assignmentLevel:level(Number(s.assignmentMarks)||0), internalLevel:level(Number(s.internalMarks)||0), externalLevel:s.externalMarks==null||s.externalMarks===''?'Not Available':level(Number(s.externalMarks))}; }
function classifyStudents(students, targetKey='category') {
  const target=TARGETS[targetKey] || TARGETS.category;
  const records=students.map(s=>{const features=featuresFor(s); return {student:s,features,label:target.makeLabel(s)};});
  const training=records.filter(r=>r.label!=='Not Available').map(r=>({label:r.label,features:r.features}));
  const attrs=target.features;
  const tree=buildTree(training,attrs);
  const counts={}; training.forEach(r=>counts[r.label]=(counts[r.label]||0)+1);
  const gains=attrs.map(attribute=>({attribute,label:({attendanceLevel:'Attendance level',marksLevel:'Overall marks level',assignmentLevel:'Assignment marks level',internalLevel:'Internal marks level',externalLevel:'External marks level'})[attribute]||attribute,gain:informationGain(training,attribute)})).sort((a,b)=>b.gain-a.gain);
  const results=records.map(({student,features,label})=>{
    const path=[]; let node=tree;
    while(node?.type==='node') { const value=features[node.attribute]; path.push(`${node.attribute.replace('Level','')} = ${value}`); node=node.branches[value]; }
    return {rollNumber:student.rollNumber,name:student.name,attendance:student.attendance,averageMarks:Number(average(student).toFixed(2)),predictedCategory:label==='Not Available'?'Not Available':predict(tree,features),actualRuleLabel:label,decisionPath:path.join(' → '),target:targetKey};
  });
  return {tree,results,diagnostics:{baseEntropy:entropy(training),classCounts:counts,gains,target:targetKey,targetLabel:target.label,targetClasses:target.classes,featureNames:attrs,methodNote:'Class labels are derived from predefined thresholds. This is a demonstration of ID3 mechanics, not an independently validated predictive model; accuracy is not reported.'}};
}
module.exports={calculateEntropy:entropy,calculateInformationGain:informationGain,buildDecisionTree:buildTree,predictCategory:predict,classifyStudents,TARGETS};
