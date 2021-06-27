<template>
  <div
    class="
      max-w-md
      mx-auto
      bg-white
      rounded-xl
      shadow-md
      overflow-hidden
      md:max-w-2xl
    "
  >
    <div class="md:flex">
      <div class="md:flex-shrink-0">
        <img
          class="h-100 w-full object-cover md:h-full md:w-64"
          src="../assets/logo.jpg"
          alt="Binod Nepali"
        />
      </div>
      <div class="p-8">
        <div
          class="uppercase tracking-wide text-sm text-indigo-500 font-semibold"
        >
          Binod Nepali
        </div>
        <a
          class="
            block
            mt-1
            text-lg
            leading-tight
            font-medium
            text-black
            hover:underline
          "
          >Fullstack Web App Developer</a
        >
        <p class="mt-2 text-gray-500">
          Hello there, My name is Binod Nepali. I am originally from Nepal. Now,
          I am living and working in the Netherlands. I had been working as a
          fulltime Fullstack Web App Developer after I had graduated in Bachelor
          of Information and Communication Technology & Software Engineer
          (Major), 2019. I am a passinote fullstack web app developer who enjoys
          developing and maintaining fullstack web based solutions suchas
          websites and web apps. Besides my work, I also enjoy working as
          Freelancer Web App Developer and IT Consultant.Therefore, If you would
          like to make websites or want custom web application for your buisness
          then you can e-mail me at nepalibinod9@gmail.com
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  name: 'About',
})
</script>
