/**
 * What a profile still needs, shared by the profile page's checklist and the
 * faculty dashboard's "complete your profile" card.
 *
 * Required items count toward the percentage; `recommended` ones are listed
 * but don't hold it back. `target` is the section id on the profile page.
 */

const filled = (v) => !!String(v || '').trim();

export const profileChecklist = ({ profilePicture, phoneNumber, bio, faculty } = {}) => {
  const items = [
    { id: 'photo', label: 'Add a profile photo', done: !!profilePicture, target: 'top' },
    { id: 'phone', label: 'Add your phone number', done: filled(phoneNumber), target: 'personal' },
    { id: 'bio', label: 'Write a short bio', done: filled(bio), target: 'about' },
  ];
  if (!faculty) return items;

  const expertise = (faculty.experiencedSubjects || []).filter((s) => filled(s.subjectCode));
  const unrated = expertise.filter((s) => !s.selfRating);
  items.push(
    {
      id: 'degree',
      label: 'Add your bachelor’s degree',
      done: filled(faculty.bachelorsDegree?.degree) || (faculty.qualifications || []).length > 0,
      target: 'education',
      why: 'Degrees decide which subjects you’re qualified for.',
    },
    {
      id: 'specializations',
      label: 'Add your specializations',
      done: (faculty.specializations || []).length > 0,
      target: 'teaching',
      why: 'Used to match you with subjects in your field.',
    },
    {
      id: 'expertise',
      label: 'List the subjects you’ve taught',
      done: expertise.length > 0,
      target: 'expertise',
      why: 'The generator prefers teachers who have taught a subject before.',
    },
    {
      id: 'self-rating',
      label: unrated.length ? `Rate yourself on ${unrated.length} subject${unrated.length === 1 ? '' : 's'}` : 'Rate yourself on each subject',
      done: expertise.length > 0 && unrated.length === 0,
      target: 'expertise',
      why: 'Tells the scheduling office which subjects you’re strongest in.',
    },
    {
      id: 'availability',
      label: 'Set times you can’t teach',
      done: (faculty.unavailableTimeSlots || []).length > 0 || (faculty.preferredTimeSlots || []).length > 0,
      target: 'availability',
      recommended: true,
      why: 'The generator won’t schedule your classes in those times.',
    },
    {
      id: 'involvement',
      label: 'Add research or extension work',
      done: filled(faculty.researchInvolvement) || filled(faculty.extensionInvolvement) || filled(faculty.productionInvolvement),
      target: 'research',
      recommended: true,
    },
  );
  return items;
};

/** { items, percent, missing } - percent counts required items only. */
export const profileCompleteness = (input) => {
  const items = profileChecklist(input);
  const required = items.filter((i) => !i.recommended);
  const percent = required.length ? Math.round((required.filter((i) => i.done).length / required.length) * 100) : 100;
  return { items, percent, missing: items.filter((i) => !i.done && !i.recommended) };
};
