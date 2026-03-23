<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'

export default {
  data() {
    return {
      formData: {
        issueType: '',
        title: '',
        description: '',
        priority: ''
      },
      loading: false
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

    async handleSubmit() {
      try {
        if (!this.formData.issueType || !this.formData.title || !this.formData.description) {
          this.showToast('Issue type, title, and description are required.', true)
          return
        }

        this.loading = true

        const submitData = {
          issueType: this.formData.issueType,
          title: this.formData.title,
          description: this.formData.description,
          priority: this.formData.priority || null
        }

        console.log('Submitting ticket data:', submitData)

        const res = await axios.post(
          `${Const.BASE_URL}/helpDesk/raiseTicket`,
          submitData,
          {
            headers: {
              'access-token': localStorage.getItem('accessToken')
            }
          }
        )

        if (res.data?.status === 200) {
          this.showToast('Ticket raised successfully', false)
          this.$emit('ticket-raised', res.data.ticket)
          this.resetForm()
        } else {
          const message = res.data?.message || 'Failed to raise ticket'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error:', error.response?.data || error.message)
        const message = error.response?.data?.message || 'Failed to raise ticket, please try again'
        this.showToast(message, true)
      } finally {
        this.loading = false
      }
    },

    resetForm() {
      this.formData = {
        issueType: '',
        title: '',
        description: '',
        priority: ''
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
          <h5 class="modal-title">Raise Ticket</h5>
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
              <label for="issueType" class="form-label">Issue Type</label>
              <select id="issueType" class="form-control" v-model="formData.issueType">
                <option value="">Select Issue Type</option>
                <option value="technical">Technical</option>
                <option value="billing">Billing</option>
                <option value="general">General</option>
              </select>
            </div>

            <div class="col-md-6 mb-3">
              <label for="priority" class="form-label">Priority</label>
              <select id="priority" class="form-control" v-model="formData.priority">
                <option value="">Select Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div class="col-md-12 mb-3">
              <label for="title" class="form-label">Issue Title</label>
              <input
                type="text"
                class="form-control"
                id="title"
                v-model="formData.title"
              />
            </div>

            <div class="col-md-12 mb-3">
              <label for="description" class="form-label">Description</label>
              <textarea
                class="form-control"
                id="description"
                rows="4"
                v-model="formData.description"
              ></textarea>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal">Close</button>
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