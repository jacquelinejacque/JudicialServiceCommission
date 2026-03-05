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
        officerName: '',
        designation: '',
        dateFiled: '',
        natureOfCharges: '',
        panel: '',
        decision: '',
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
            ...newVal,
          }
        }
      }
    },
    
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
    async handleSubmit() {
      try {
        this.loading = true
        const updateData = {
          recordId: this.record.recordID,
          officerName: this.formData.officerName,
          designation: this.formData.designation,
          dateFiled: this.formData.dateFiled,
          natureOfCharges: this.formData.natureOfCharges,
          panel: this.formData.panel,
          decision: this.formData.decision,
        }
        const res = await axios.post(`${Const.BASE_URL}/disciplinaryRecords/update`, updateData, {
          headers: { 'access-token': localStorage.getItem('accessToken') }
        })
        console.log(res.data)
        if (res.data?.status === 200) {
          this.showToast('Record details successfully updated', false)
          this.$emit('record-Edited');
        } else {
          const message = res.data.message || 'Failed to update record'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error(error)
        this.showToast('Failed to update record')
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
              <label for="officerName" class="form-label">Officer Name</label>
              <input type="text" class="form-control" id="officerName" v-model="formData.officerName" required />
            </div>
           
            <div class="col-md-6 mb-3">
              <label for="designation" class="form-label">Designation</label>
              <input
                type="text"
                class="form-control"
                id="designation"
                v-model="formData.designation"
                required
              />
            </div>
            <div class="col-md-6 mb-3">
              <label for="dateFiled" class="form-label">Date Filed</label>
              <input
                type="date"
                class="form-control"
                id="dateFiled"
                v-model="formData.dateFiled"
                required
              />
            </div>
            <div class="col-md-6 mb-3">
              <label for="decision" class="form-label">Decision</label>
              <input type="text" class="form-control" id="decision" v-model="formData.decision" required />
            </div>        
            <div class="col-md-6 mb-3">
              <label for="natureOfCharges" class="form-label">Nature of Charges</label>
              <input type="text" class="form-control" id="natureOfCharges" v-model="formData.natureOfCharges" required />
            </div>                
            <div class="col-md-6 mb-3">
                <label for="panel" class="form-label">Panel</label>
                <select
                    class="form-control"
                    id="panel"
                    v-model="formData.panel"
                    required
                >
                    <option disabled value="">Select Panel</option>
                    <option value="panel1">Panel 1</option>
                    <option value="panel2">Panel 2</option>
                </select>
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