<script>
  import { Const } from '@/utils/constants'
  import axios from 'axios'
  import Toastify from 'toastify-js'
  import { Toast } from 'bootstrap/dist/js/bootstrap.bundle'

  export default {
    props: {
      record: { type: Object, required: true }
    },
    data() {
      return {
        formData: {
          source: '',
          title: '',
          complainantName: '',
          reportFile: null
        },
        loading: false,
        formSubmitted: false,
        toastElement: null
      }
    },

    watch: {
      record: {
        immediate: true,
        handler(newVal) {
          if (newVal) {
            this.formData = {
              source: newVal.source || '',
              title: newVal.title || '',
              complainantName: newVal.complainantName || '',
              reportFile: null
            }
          }
        }
      }
    },

    mounted() {
      (this.toastElement = new Toast(document.getElementById('newRecord-toast')))
    
    },

    methods: {
      showToast(message, isDanger) {
        Toastify({
          text: message,
          // className: className,
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
          this.loading = true

          const updateData = new FormData()
          updateData.append('recordID', this.record.recordID)
          updateData.append('source', this.formData.source)
          updateData.append('title', this.formData.title)

          if (this.formData.source === 'PUBLIC') {
            updateData.append('complainantName', this.formData.complainantName || '')
          }

          if (this.formData.reportFile) {
            updateData.append('reportFile', this.formData.reportFile)
          }

          const res = await axios.post(
            `${Const.BASE_URL}/disciplinaryRecords/updateReport`,
            updateData,
            {
              headers: {
                'access-token': localStorage.getItem('accessToken')
              }
            }
          )

          if (res.data?.status === 200) {
            this.showToast('Record details successfully updated', false)
            this.$emit('record-Edited')
          } else {
            const message = res.data.message || 'Failed to update record'
            this.showToast(message, true)
          }
        } catch (error) {
          console.error(error)
          this.showToast('Failed to update record', true)
        } finally {
          this.loading = false
        }
      },

    }
  }
</script>

<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Edit Record Details</h5>
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
              <label for="title" class="form-label">Title</label>
              <input type="text" class="form-control" id="title" v-model="formData.title" required />
            </div>
           
            <div class="col-md-6 mb-3">
              <label for="source" class="form-label">Source</label>
              <select
                class="form-control"
                id="source"
                v-model="formData.source"
                required
              >
                <option value="">Select Source</option>
                <option value="OCJ">OCJ</option>
                <option value="PUBLIC">PUBLIC</option>
              </select>
            </div>

            <div class="col-md-6 mb-3" v-if="formData.source === 'PUBLIC'">
              <label for="complainantName" class="form-label">Complainant Name</label>
              <input
                type="text"
                class="form-control"
                id="complainantName"
                v-model="formData.complainantName"
                required
              />
            </div>   
            <div class="col-md-6 mb-3">
              <label for="reportFile" class="form-label">Replace Report File</label>
              <input
                type="file"
                class="form-control"
                id="reportFile"
                @change="handleFileChange"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
              />
              <small class="text-muted">
                Leave empty if you do not want to change the current file.
              </small>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal">Close</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Updating...</span>
            <span v-if="!loading">Update</span>
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

.list-group-item-primary {
  background-color: #d1ecf1;
  color: #0c5460;
  font-weight: bold;
}
</style>