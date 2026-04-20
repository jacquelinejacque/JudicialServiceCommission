<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'

export default {
  data() {
    return {
      formData: {
        source: '',
        title: '',
        complainantName: '',
        reportFile: null
      },
      loading: false,
      formSubmitted: false
    }
  },

  methods: {
    showToast(message, isDanger) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },

    handleFileChange(event) {
      const file = event.target.files[0]
      this.formData.reportFile = file || null
    },

    async handleSubmit() {
    try {
        if (!this.formData.source) {
        this.showToast('Source is required.', true)
        return
        }

        if (!['OCJ', 'PUBLIC'].includes(this.formData.source)) {
        this.showToast('Source must be OCJ or PUBLIC.', true)
        return
        }

        if (
        this.formData.source === 'PUBLIC' &&
        !this.formData.complainantName
        ) {
        this.showToast('Complainant name is required for public reports.', true)
        return
        }
        if (!this.formData.title) {
        this.showToast('Title is required.', true)
        return
        }
        if (!this.formData.reportFile) {
        this.showToast('Report file is required.', true)
        return
        }

        this.loading = true

        const submitData = new FormData()
        submitData.append('source', this.formData.source)

        if (this.formData.source === 'PUBLIC') {
        submitData.append('complainantName', this.formData.complainantName)
        }
        submitData.append('title', this.formData.title)
        submitData.append('reportFile', this.formData.reportFile)

        const res = await axios.post(
        `${Const.BASE_URL}/disciplinaryRecords/createReport`,
        submitData,
        {
            headers: {
            'access-token': localStorage.getItem('accessToken')
            }
        }
        )

        const message = res.data?.message || 'Request completed successfully'

        if (res.data?.status === 200) {
          this.showToast(message, false)
          this.resetForm()
          this.$emit('report-Added')        
        } else {
        this.showToast(message, true)
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message)

        const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to create report, please try again'

        this.showToast(message, true)
    } finally {
        this.loading = false
    }
    },

    resetForm() {
      this.formData = {
        source: '',
        complainantName: '',
        title: '',
        reportFile: null
      }

      this.formSubmitted = false
      const fileInput = document.getElementById('reportFile')
      if (fileInput) {
        fileInput.value = ''
      }
    }
  }
}
</script>

<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Create New Report</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>

        <div class="modal-body">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="source" class="form-label">Source</label>
              <select
                id="source"
                v-model="formData.source"
                class="form-control"
              >
                <option value="">Select Source</option>
                <option value="OCJ">OCJ</option>
                <option value="PUBLIC">PUBLIC</option>
              </select>
            </div>

            <div
              v-if="formData.source === 'PUBLIC'"
              class="col-md-6 mb-3"
            >
              <label for="complainantName" class="form-label">
                Complainant Name
              </label>
              <input
                type="text"
                class="form-control"
                id="complainantName"
                v-model="formData.complainantName"
              />
            </div>

            <div              
              class="col-md-6 mb-3"
            >
              <label for="title" class="form-label">
                Title
              </label>
              <input
                type="text"
                class="form-control"
                id="title"
                v-model="formData.title"
              />
            </div>

            <div class="col-md-12 mb-3">
              <label for="reportFile" class="form-label">Report File</label>
              <input
                type="file"
                class="form-control"
                id="reportFile"
                @change="handleFileChange"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
              />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn me-auto"
            data-bs-dismiss="modal"
          >
            Close
          </button>

          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Submitting...</span>
            <span v-else>Submit</span>
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style>
.form {
  display: flex;
  flex-direction: column;
}
</style>