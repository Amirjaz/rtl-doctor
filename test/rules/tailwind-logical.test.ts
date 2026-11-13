import { rules } from "../../src/plugin.js";
import { ruleTester } from "../helpers.js";

const rule = rules["tailwind-logical"];

ruleTester("4.3").run("tailwind-logical (Tailwind 4.3)", rule, {
  valid: [
    `<div className="ms-4 ps-2 pe-1 me-auto text-start float-start rounded-s-md border-e inset-s-0" />`,
    // Symmetric pairs set both sides alike, so they are direction-neutral.
    `<div className="pl-4 pr-4" />`,
    `<div className="left-0 right-0 absolute" />`,
    `<div className="rounded-tl-lg rounded-tr-lg" />`,
    `<div className="md:ml-2 md:mr-2" />`,
    // The centring idiom works in both directions.
    `<div className="absolute left-1/2 -translate-x-1/2" />`,
    // Explicit direction variants are deliberate.
    `<div className="ltr:ml-2 rtl:mr-2" />`,
    `<div className="[dir=rtl]:ml-2 in-[[dir=ltr]]:pl-4" />`,
    // Look-alikes that are not physical utilities.
    `<div className="rounded-lg border-lime-500 place-items-center prose pl text-left-foo leftover" />`,
    // v4 already writes space-x with logical properties.
    `<div className="flex space-x-4 divide-x" />`,
    // A reversed flex row needs space-x-reverse in either direction.
    `<div className="flex rtl:flex-row-reverse flex-row-reverse rtl:space-x-reverse" />`,
    // Only whole classes are checked.
    "<div className={`ml-${size}`} />",
    '<div className={"ml-" + size} />',
    "<div className={`${base}pl-2`} />",
    `<div className={classes} />`,
    // Not a class attribute, call or variable.
    `<div data-side="ml-4" title="text-left" />`,
    `const label = "ml-4";`,
    `format("pl-4");`,
  ],
  invalid: [
    {
      code: `<div className="ml-4 pl-2 text-left" />`,
      output: `<div className="ms-4 ps-2 text-start" />`,
      errors: [{ messageId: "physical" }, { messageId: "physical" }, { messageId: "physical" }],
    },
    {
      code: `<div className="md:hover:-ml-4 !pr-2 pr-3! group-hover/item:mr-[13px]" />`,
      output: `<div className="md:hover:-ms-4 !pe-2 pe-3! group-hover/item:me-[13px]" />`,
      errors: 4,
    },
    {
      code: `<div className="absolute left-0 top-0 -right-2" />`,
      output: `<div className="absolute inset-s-0 top-0 -inset-e-2" />`,
      errors: 2,
    },
    {
      code: `<div className="rounded-l-md rounded-tr-lg rounded-bl rounded-br-none border-l-2 border-r-red-500 border-l float-left clear-right" />`,
      output: `<div className="rounded-s-md rounded-se-lg rounded-es rounded-ee-none border-s-2 border-e-red-500 border-s float-start clear-end" />`,
      errors: 9,
    },
    {
      code: `<div className="scroll-ml-4 scroll-pr-2 text-right" />`,
      output: `<div className="scroll-ms-4 scroll-pe-2 text-end" />`,
      errors: 3,
    },
    {
      // Each branch is an alternative, not a symmetric pair.
      code: `<div className={open ? "ml-2" : "mr-2"} />`,
      output: `<div className={open ? "ms-2" : "me-2"} />`,
      errors: 2,
    },
    {
      code: `<div className={cn("ml-2", active && "pl-4", { "mr-1": x }, [isOpen ? "left-2" : null])} />`,
      output: `<div className={cn("ms-2", active && "ps-4", { "me-1": x }, [isOpen ? "inset-s-2" : null])} />`,
      errors: 4,
    },
    {
      code: `const button = cva("pl-4 rounded-l", { variants: { size: { sm: "pr-2", lg: "pr-6" } }, defaultVariants: { size: "sm" } });`,
      output: `const button = cva("ps-4 rounded-s", { variants: { size: { sm: "pe-2", lg: "pe-6" } }, defaultVariants: { size: "sm" } });`,
      errors: 4,
    },
    {
      code: "<div className={`ml-2 ${a} pr-4 ${b} text-left`} />",
      output: "<div className={`ms-2 ${a} pe-4 ${b} text-start`} />",
      errors: 3,
    },
    {
      code: `const header = tw\`ml-2 flex\`; const Box = tw.div\`pl-3\`;`,
      output: `const header = tw\`ms-2 flex\`; const Box = tw.div\`ps-3\`;`,
      errors: 2,
    },
    {
      code: `const wrapperClassName = "ml-2"; const CARD_CLASSES = "pr-4";`,
      output: `const wrapperClassName = "ms-2"; const CARD_CLASSES = "pe-4";`,
      errors: 2,
    },
    {
      code: `<Input inputClassName="pl-3" class="mr-1" />`,
      output: `<Input inputClassName="ps-3" class="me-1" />`,
      errors: 2,
    },
    {
      code: `<div className={twMerge("ml-2 " + extra)} />`,
      output: `<div className={twMerge("ms-2 " + extra)} />`,
      errors: 1,
    },
    {
      // v4 writes space-x with margin-inline, so reversing it under rtl puts the gap on the wrong side.
      code: `<div className="flex space-x-4 rtl:space-x-reverse" />`,
      output: `<div className="flex space-x-4" />`,
      errors: [{ messageId: "spaceReverseHarmful" }],
    },
    {
      code: `<div className="rtl:divide-x-reverse divide-x" />`,
      output: `<div className="divide-x" />`,
      errors: [{ messageId: "spaceReverseHarmful" }],
    },
  ],
});

ruleTester("4.1").run("tailwind-logical (Tailwind 4.1, before inset-s)", rule, {
  valid: [],
  invalid: [
    {
      code: `<div className="left-4 -right-1 left-1/3" />`,
      output: `<div className="start-4 -end-1 start-1/3" />`,
      errors: 3,
    },
  ],
});

ruleTester("3.4").run("tailwind-logical (Tailwind 3.4)", rule, {
  valid: [
    `<div className="flex space-x-4 rtl:space-x-reverse" />`,
    `<div className="flex divide-x rtl:divide-x-reverse" />`,
    `<div className="flex space-x-0" />`,
    `<div className="flex flex-row-reverse space-x-4 space-x-reverse" />`,
  ],
  invalid: [
    {
      code: `<div className="absolute left-0 ml-2" />`,
      output: `<div className="absolute start-0 ms-2" />`,
      errors: 2,
    },
    {
      // v3 writes space-x with margin-left, so RTL needs the reverse.
      code: `<div className="flex md:space-x-4 items-center" />`,
      output: `<div className="flex md:space-x-4 rtl:space-x-reverse items-center" />`,
      errors: [{ messageId: "spaceReverseMissing" }],
    },
    {
      code: `<div className="flex divide-x-2 -space-x-2" />`,
      output: `<div className="flex divide-x-2 rtl:divide-x-reverse -space-x-2 rtl:space-x-reverse" />`,
      errors: 2,
    },
    {
      code: `<div className="tw-ml-2 md:tw-pl-4 tw-space-x-2" />`,
      output: `<div className="tw-ms-2 md:tw-ps-4 tw-space-x-2 rtl:tw-space-x-reverse" />`,
      options: [{ prefix: "tw-" }],
      errors: 3,
    },
  ],
});

ruleTester("3.2").run("tailwind-logical (Tailwind 3.2, no logical utilities)", rule, {
  valid: [],
  invalid: [
    {
      code: `<div className="ml-2 text-left" />`,
      output: `<div className="ml-2 text-start" />`,
      errors: [{ messageId: "physicalNoFix" }, { messageId: "physical" }],
    },
  ],
});

ruleTester("4.3").run("tailwind-logical (right-to-left layout)", rule, {
  valid: [
    // In RTL these are already the inline-start side, written as the logical twin.
    { code: `<div className="me-4 pe-2 text-start inset-e-0" />`, settings: { rtlDoctor: { tailwindVersion: "4.3", direction: "rtl" } } },
  ],
  invalid: [
    {
      // The fix keeps today's look: in RTL the left side is inline-end.
      code: `<div className="ml-4 pl-2 text-left rounded-l-md border-l-2 float-left left-0" />`,
      output: `<div className="me-4 pe-2 text-end rounded-e-md border-e-2 float-end inset-e-0" />`,
      settings: { rtlDoctor: { tailwindVersion: "4.3", direction: "rtl" } },
      errors: 7,
    },
    {
      code: `<div className="ml-4" />`,
      output: `<div className="me-4" />`,
      options: [{ direction: "rtl" }],
      errors: [{ messageId: "physical" }],
    },
    {
      // An LTR island inside an RTL app: phone numbers, code, emails.
      code: `<div dir="rtl"><input dir="ltr" className="text-left" /><p className="text-left">x</p></div>`,
      output: `<div dir="rtl"><input dir="ltr" className="text-start" /><p className="text-end">x</p></div>`,
      settings: { rtlDoctor: { tailwindVersion: "4.3", direction: "rtl" } },
      errors: 2,
    },
    {
      // The nearest dir wins over the app default.
      code: `<section dir="rtl"><span className="pl-2" /></section>`,
      output: `<section dir="rtl"><span className="pe-2" /></section>`,
      errors: 1,
    },
    {
      // dir="auto" or a dynamic dir: no single fix keeps the look, so report without one.
      code: `<div dir="auto" className="ml-4" />`,
      options: [{ direction: "rtl" }],
      errors: [{ messageId: "physicalNoFix" }],
    },
    {
      code: `<div dir={dir} className="ml-4" />`,
      errors: [{ messageId: "physicalNoFix" }],
    },
    {
      code: `<div className="ml-4" />`,
      options: [{ direction: "both" }],
      errors: [
        {
          message:
            "`ml-4` sets margin-left, which is wrong in one of the directions this renders in; use `ms-4` if it was designed left-to-right or `me-4` if right-to-left.",
        },
      ],
    },
  ],
});
