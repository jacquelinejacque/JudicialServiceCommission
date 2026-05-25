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
        badgeReturned: true,
        checkOutTime: '',
        remarks: '',
        badgeRemarks: ''
      }
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
      if (typeof this.formData.badgeReturned !== 'boolean') {
        this.showToast('Please select whether the badge was returned', true)
        return false
      }

      if (this.formData.badgeReturned === false && !this.formData.badgeRemarks) {
        this.showToast('Badge remarks are required when badge is not returned', true)
        return false
      }

      return true
    },

    async submitCheckOut() {
      try {
        if (!this.validateForm()) return

        this.loading = true

        const payload = {
          visitID: this.visitID,
          badgeReturned: this.formData.badgeReturned,
          remarks: this.formData.remarks || ''
        }

        if (this.formData.checkOutTime) {
          payload.checkOutTime = new Date(this.formData.checkOutTime).toISOString()
        }

        if (this.formData.badgeRemarks) {
          payload.badgeRemarks = this.formData.badgeRemarks
        }

        const res = await axios.post(
          `${Const.BASE_URL}/guestsVisits/checkOut`,
          payload,
          {
            headers: {
              'access-token': localStorage.getItem('accessToken'),
              'Content-Type': 'application/json'
            }
          }
        )

        if (res.data?.status === 200) {
          this.showToast(res.data?.message || 'Guest checked out successfully')
          this.$emit('checkout-completed')
        } else {
          this.showToast(res.data?.error || res.data?.message || 'Checkout failed', true)
        }
      } catch (error) {
        const message =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          'Failed to check out guest'

        this.showToast(message, true)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<template>
  <form @submit.prevent="submitCheckOut" class="w-100">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Check Out Guest</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>

      <div class="modal-body">
        <div class="row">
          <div class="col-md-6 mb-3">
            <label class="form-label">Badge Returned?</label>
            <select v-model="formData.badgeReturned" class="form-select">
              <option :value="true">Yes, badge returned</option>
              <option :value="false">No, badge not returned</option>
            </select>
          </div>

          <div class="col-md-6 mb-3">
            <label class="form-label">Check-Out Time</label>
            <input
              type="datetime-local"
              class="form-control"
              v-model="formData.checkOutTime"
            />
            <small class="text-muted">Leave blank to use current time.</small>
          </div>

          <div class="col-md-12 mb-3">
            <label class="form-label">Visit Remarks</label>
            <textarea
              class="form-control"
              rows="3"
              v-model="formData.remarks"
              placeholder="Optional checkout remarks"
            ></textarea>
          </div>

          <div class="col-md-12 mb-3" v-if="formData.badgeReturned === false">
            <label class="form-label">Badge Remarks</label>
            <textarea
              class="form-control"
              rows="3"
              v-model="formData.badgeRemarks"
              placeholder="Explain why the badge was not returned"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn me-auto" data-bs-dismiss="modal">
          Close
        </button>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          <span v-if="loading">Checking out...</span>
          <span v-else>Check Out Guest</span>
        </button>
      </div>
    </div>
  </form>
</template>