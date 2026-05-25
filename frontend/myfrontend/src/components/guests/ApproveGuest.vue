<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'

export default {
  props: {
    visitID: {
      type: String,
      required: true
    }
  },

  data() {
    return {
      loading: false,
      formData: {
        approvalAction: '',
        approvalReason: '',
        denialReason: '',
        timeIn: 60,
        checkInTime: ''
      }
    }
  },

  computed: {
    isApproved() {
      return this.formData.approvalAction === 'approved'
    },
    isDenied() {
      return this.formData.approvalAction === 'denied'
    }
  },

  methods: {
    showToast(message, isDanger = false) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },

    validateForm() {
      if (!this.formData.approvalAction) {
        this.showToast('Approval action is required', true)
        return false
      }

      if (this.isApproved) {
        if (!this.formData.approvalReason) {
          this.showToast('Approval reason is required', true)
          return false
        }

        if (!this.formData.timeIn || parseInt(this.formData.timeIn) <= 0) {
          this.showToast('Visit duration is required', true)
          return false
        }
      }

      if (this.isDenied && !this.formData.denialReason) {
        this.showToast('Denial reason is required', true)
        return false
      }

      return true
    },

    async submitApproval() {
      try {
        if (!this.validateForm()) return

        this.loading = true

        let payload = {
          visitID: this.visitID,
          approvalAction: this.formData.approvalAction
        }

        if (this.isApproved) {
          payload.approvalReason = this.formData.approvalReason
          payload.timeIn = this.formData.timeIn

          if (this.formData.checkInTime) {
            payload.checkInTime = new Date(this.formData.checkInTime).toISOString()
          }
        }

        if (this.isDenied) {
          payload.denialReason = this.formData.denialReason
        }

        const res = await axios.post(
          `${Const.BASE_URL}/guestsVisits/hostApproveGuest`,
          payload,
          {
            headers: {
              'access-token': localStorage.getItem('accessToken'),
              'Content-Type': 'application/json'
            }
          }
        )

        if (res.data?.status === 200) {
          this.showToast(res.data?.message || 'Approval processed successfully')
          this.$emit('approval-completed')
        } else {
          this.showToast(res.data?.error || res.data?.message || 'Approval failed', true)
        }
      } catch (error) {
        const message =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          'Failed to process approval'

        this.showToast(message, true)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<template>
  <form @submit.prevent="submitApproval" class="w-100">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Approve Guest Visit</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>

      <div class="modal-body">
        <div class="mb-3">
          <label class="form-label">Approval Action</label>
          <select v-model="formData.approvalAction" class="form-select">
            <option value="">Select Action</option>
            <option value="approved">Approve</option>
            <option value="denied">Deny</option>
          </select>
        </div>

        <div v-if="isApproved" class="mb-3">
          <label class="form-label">Approval Reason</label>
          <textarea
            v-model="formData.approvalReason"
            class="form-control"
            rows="3"
            placeholder="Example: Guest is expected for procurement meeting"
          ></textarea>
        </div>

        <div v-if="isApproved" class="mb-3">
          <label class="form-label">Visit Duration / Time In (Minutes)</label>
          <input
            type="number"
            v-model="formData.timeIn"
            class="form-control"
            min="1"
          />
        </div>

        <div v-if="isApproved" class="mb-3">
          <label class="form-label">Check-In Time</label>
          <input
            type="datetime-local"
            v-model="formData.checkInTime"
            class="form-control"
          />
          <small class="text-muted">
            Leave blank to use current time.
          </small>
        </div>

        <div v-if="isDenied" class="mb-3">
          <label class="form-label">Denial Reason</label>
          <textarea
            v-model="formData.denialReason"
            class="form-control"
            rows="3"
            placeholder="Example: Not available to meet at this time"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn me-auto" data-bs-dismiss="modal">
          Close
        </button>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          <span v-if="loading">Submitting...</span>
          <span v-else>Submit Decision</span>
        </button>
      </div>
    </div>
  </form>
</template>